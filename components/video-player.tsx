"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ExternalLink, Play, Copy, Check, Loader2 } from "lucide-react"
import { VideoPlayer as VideoSkin } from "@/components/player/video-skin"
import { filesToSubtitleTracks, type SubtitleTrack } from "@/lib/subtitles"

const HLS_EXT = /\.m3u8($|\?)/i

// ---------------------------------------------------------------------------
// Network-adaptive quality (Auto mode)
// ---------------------------------------------------------------------------

type NetTier = "high" | "mid" | "low"

function netTier(): NetTier {
  // Client components still pre-render on the server — guard accordingly.
  if (typeof navigator === "undefined") return "high"
  const conn = (
    navigator as Navigator & {
      connection?: { downlink?: number; effectiveType?: string }
    }
  ).connection
  if (typeof conn?.downlink === "number") {
    if (conn.downlink >= 8) return "high"
    if (conn.downlink >= 3) return "mid"
    return "low"
  }
  if (conn?.effectiveType === "4g") return "high"
  if (conn?.effectiveType === "3g") return "mid"
  if (conn?.effectiveType) return "low"
  // Unknown — assume plenty; the stall monitor will step down if needed.
  return "high"
}

/** Index into a best-first variant list for the given network tier. */
function tierIndexFor(tier: NetTier, count: number): number {
  if (count <= 1) return 0
  if (tier === "high") return 0
  if (tier === "mid") return Math.floor(count / 2)
  return count - 1
}

export function VideoPlayer({
  url,
  label,
  variants,
  onUnresolved,
  onUrlChange,
}: {
  url: string | null
  label?: string
  /** All labeled sources for this title (catalog qualities). */
  variants?: { label: string; url: string }[]
  // Fired when resolution ultimately fails for this url (after retries) so
  // parents can mark the source as unavailable.
  onUnresolved?: (url: string) => void
  /** Parent handler to swap the active source (in-player quality switch). */
  onUrlChange?: (url: string) => void
}) {
  // Dev/QA escape hatch: ?vsrc=<url> bypasses link resolution. Guarded for
  // SSR — client components still pre-render on the server.
  const [vsrcOverride] = useState(() =>
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("vsrc")
  )
  const [copied, setCopied] = useState(false)
  // Preserve playback position across in-player quality switches.
  const resumeAtRef = useRef<number | null>(null)
  // Sources already attempted during auto-descend, so failures cascade
  // downward without looping.
  const triedUrlsRef = useRef<Set<string>>(new Set())
  // Hard cap on total failure-handling passes: guarantees the fallback
  // chain terminates even if dev double-invocation or repeated silent
  // source failures would otherwise loop.
  const failureCountRef = useRef(0)
  const titleKeyRef = useRef<string | null>(null)
  // Where Auto mode would place us on this title (null = already there).
  const tierTargetUrl = useMemo(() => {
    if (!variants || variants.length < 2) return null
    const opts = variants.map((v) => ({ id: v.url, label: v.label }))
    const idx = tierIndexFor(netTier(), opts.length)
    const t = opts[Math.min(idx, opts.length - 1)]
    return t && t.id !== url ? t.id : null
  }, [variants, url])
  const [videoUrl, setVideoUrl] = useState<string | null>(vsrcOverride)
  const [resolving, setResolving] = useState(Boolean(url) && !vsrcOverride)
  const [error, setError] = useState(false)
  const [resolveAttempt, setResolveAttempt] = useState(0)
  const [useHlsProxy, setUseHlsProxy] = useState(false)
  // Tokenized /go URLs the browser must traverse itself; walked in order on
  // playback errors since individual mirror types can be dead.
  const [goUrls, setGoUrls] = useState<string[]>([])
  const [goIdx, setGoIdx] = useState(0)
  const [goMode, setGoMode] = useState(false)
  // Auto quality: pick per network speed, adapt on stalls/smooth playback.
  const [autoMode, setAutoMode] = useState(true)
  const autoAppliedKeyRef = useRef<string | null>(null)
  const lastSwitchRef = useRef(0)
  const stallRef = useRef({ count: 0, windowStart: 0 })
  const healthySinceRef = useRef<number | null>(null)
  // Subtitle tracks: user uploads plus embedded streams discovered via
  // /api/subs. Embedded entries start with src="" and extract on demand;
  // pendingSub tracks that in-flight request.
  const [subs, setSubs] = useState<SubtitleTrack[]>([])
  // Audio switcher: sidecar-discovered tracks; selecting a non-default
  // one swaps the source to a remuxed stream (video + chosen audio).
  const [audioOptions, setAudioOptions] = useState<
    { id: string; label: string }[]
  >([])
  const [activeAudioId, setActiveAudioId] = useState("default")
  const [pendingSub, setPendingSub] = useState<string | null>(null)

  const [prevUrl, setPrevUrl] = useState(url)
  // Keep the latest callback in a ref so the resolve effect doesn't re-run
  // when parents pass a fresh inline function each render.
  const onUnresolvedRef = useRef(onUnresolved)
  // Latest onUrlChange without retriggering effects on inline props.
  const onUrlChangeRef = useRef(onUrlChange)
  useEffect(() => {
    onUnresolvedRef.current = onUnresolved
    onUrlChangeRef.current = onUrlChange
  })
  if (url !== prevUrl) {
    setPrevUrl(url)
    setVideoUrl(null)
    setError(false)
    setResolving(Boolean(url))
    setResolveAttempt(0)
    setUseHlsProxy(false)
    setGoUrls([])
    setGoIdx(0)
    setGoMode(false)
    setSubs([])
    setPendingSub(null)
  }

  // External source change resets the auto-descend ledger so failures
  // cascade from the new source downward.
  useEffect(() => {
    triedUrlsRef.current = new Set(url ? [url] : [])
  }, [url])

  const variantsTitleKey = variants?.[0]?.url ?? null
  useEffect(() => {
    if (variantsTitleKey !== titleKeyRef.current) {
      titleKeyRef.current = variantsTitleKey
      failureCountRef.current = 0
    }
  }, [variantsTitleKey])

  useEffect(() => {
    if (!url) return
    let cancelled = false

    // Resolved links can be transient (single-use tokens, upstream blips),
    // so give the first failure one quiet retry before surfacing it.
    async function resolve(triesLeft: number) {
      try {
        const r = await fetch(`/api/resolve?url=${encodeURIComponent(url!)}`)
        const data = await r.json()
        if (cancelled) return
        // videoUrl = server-verified direct file. goUrl(s) = tokenized hop
        // URLs the browser itself must traverse (upstreams block datacenter
        // IPs, so the server cannot follow the chain).
        const list: string[] = Array.isArray(data.goUrls)
          ? data.goUrls.map((g: { url?: string }) => g.url).filter(Boolean)
          : []
        const src: string | undefined = data.videoUrl || data.goUrl || list[0]
        if (src) {
          setGoUrls(list.length > 0 ? list : [src])
          setGoIdx(0)
          setVideoUrl(src)
          setResolving(false)
          // Mirror-only mode means the browser will hit interstitial pages;
          // don't burn multiple re-resolve rounds before the embed fallback.
          setGoMode(!data.videoUrl)
          return
        }
        throw new Error("no source")
      } catch {
        if (cancelled) return
        if (triesLeft > 0) {
          setTimeout(() => {
            if (!cancelled) resolve(triesLeft - 1)
          }, 1200)
          return
        }
        setError(true)
        setResolving(false)
        onUnresolvedRef.current?.(url!)
      }
    }

    if (vsrcOverride) return

    // Auto mode: on first sight of a title, start at the tier the network
    // supports instead of blindly opening the best source.
    const titleKey = (variants ?? []).map((v) => v.url).join("|")
    if (
      autoMode &&
      !vsrcOverride &&
      (variants?.length ?? 0) > 1 &&
      autoAppliedKeyRef.current !== titleKey
    ) {
      autoAppliedKeyRef.current = titleKey
      if (tierTargetUrl) {
        lastSwitchRef.current = Date.now()
        triedUrlsRef.current = new Set([tierTargetUrl])
        onUrlChangeRef.current?.(tierTargetUrl)
        return
      }
    }

    resolve(1)

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- qualityOptions/variants are derived; the tier pick runs once per title via autoAppliedKeyRef
  }, [url, resolveAttempt, autoMode])

  // Firefox/Safari cannot demux MKV natively while Chrome tolerates it.
  // Route non-HLS sources through the server-side transmux proxy when the
  // browser reports a playback error on the direct file.
  // In-player quality menu: every other catalog variant, labeled by its
  // bracketed quality tag (480p/720p/…) when present.
  // In-player quality menu: every catalog variant (including the active
  // one), labeled by its bracketed quality tag (480p/720p/…) when present.
  const qualityTag = (raw: string) =>
    new RegExp("(\\d{3,4}p\\b)", "i").exec(raw)?.[1] ??
    new RegExp("\\[([^\\]]+)\\]").exec(raw)?.[1] ??
    raw.slice(0, 24)
  const qualityOptions = useMemo(() => {
    const opts = (variants ?? []).map((v) => ({
      id: v.url,
      label: qualityTag(v.label),
    }))
    if (url && !opts.some((o) => o.id === url)) {
      opts.unshift({ id: url, label: qualityTag(label ?? "Current") })
    }
    return opts
    // qualityTag is a pure helper defined above; stable across renders.
  }, [variants, url, label])

  // Shared programmatic switch: saves position, clears transient failure
  // state, throttles rapid auto-adjustments (manual picks bypass throttle).
  function switchTo(id: string) {
    if (!id || id === url) return
    const v = document.querySelector<HTMLVideoElement>(
      ".media-default-skin video"
    )
    if (v && Number.isFinite(v.currentTime)) resumeAtRef.current = v.currentTime
    setUseHlsProxy(false)
    setResolveAttempt(0)
    setError(false)
    setResolving(true)
    setSubs([])
    setGoUrls([])
    setGoIdx(0)
    setGoMode(false)
    lastSwitchRef.current = Date.now()
    triedUrlsRef.current = new Set([id])
    onUrlChangeRef.current?.(id)
  }

  // The variant Auto currently maps to — drives the "Auto · <label>" hint.
  const autoPick = useMemo(() => {
    if (qualityOptions.length === 0) return null
    const idx = tierIndexFor(netTier(), qualityOptions.length)
    return qualityOptions[idx] ?? qualityOptions[0]
    // Recomputed when the catalog changes; netTier is read live elsewhere.
  }, [qualityOptions])

  const menuQualities = useMemo(() => {
    const list = [...qualityOptions]
    if (qualityOptions.length > 1) {
      list.unshift({
        id: "auto",
        label: autoPick ? `Auto · ${autoPick.label}` : "Auto",
      })
    }
    return list
  }, [qualityOptions, autoPick])

  function handleQualityMenu(id: string) {
    if (id === "auto") {
      setAutoMode(true)
      if (autoPick) switchTo(autoPick.id)
      return
    }
    setAutoMode(false)
    handleQualityChange(id)
  }

  function handleQualityChange(id: string) {
    if (id === url) return
    triedUrlsRef.current = new Set([id])
    const v = document.querySelector<HTMLVideoElement>(
      ".media-default-skin video"
    )
    if (v && Number.isFinite(v.currentTime)) resumeAtRef.current = v.currentTime
    setUseHlsProxy(false)
    setResolveAttempt(0)
    setError(false)
    setResolving(true)
    setSubs([])
    setGoUrls([])
    setGoIdx(0)
    setGoMode(false)
    // Reuse the parent's url-change flow so caches and fallbacks apply.
    onUrlChangeRef.current?.(id)
  }

  // Auto-descend helper: switch to the next untried catalog variant,
  // preserving playback position. Returns false when nothing is left.
  function descendQuality(): boolean {
    const candidates = qualityOptions.filter(
      (o) => o.id !== url && !triedUrlsRef.current.has(o.id)
    )
    const next = candidates[0]
    if (!next) return false
    triedUrlsRef.current.add(url!)
    triedUrlsRef.current.add(next.id)
    const v = document.querySelector<HTMLVideoElement>(
      ".media-default-skin video"
    )
    if (v && Number.isFinite(v.currentTime)) resumeAtRef.current = v.currentTime
    setUseHlsProxy(false)
    setResolveAttempt(0)
    setResolving(true)
    onUrlChangeRef.current?.(next.id)
    return true
  }

  const playSrc = useMemo(() => {
    if (!videoUrl) return null
    // Non-default audio selected: sidecar remuxes video + chosen track.
    if (activeAudioId !== "default") {
      return `/api/subs?mode=audio&url=${encodeURIComponent(videoUrl)}&index=${activeAudioId}`
    }
    if (HLS_EXT.test(videoUrl)) return videoUrl
    if (!useHlsProxy) return videoUrl
    return `/api/stream/direct/index.m3u8?url=${encodeURIComponent(videoUrl)}`
  }, [videoUrl, useHlsProxy, activeAudioId])

  function handleAudioChange(id: string) {
    if (id === activeAudioId) return
    const v = document.querySelector<HTMLVideoElement>(
      ".media-default-skin video"
    )
    if (v && Number.isFinite(v.currentTime)) resumeAtRef.current = v.currentTime
    setActiveAudioId(id)
  }

  // Live adaptation in Auto mode: repeated buffering steps the quality
  // down; long smooth playback allows stepping up (throttled).
  useEffect(() => {
    if (!playSrc || !autoMode || qualityOptions.length < 2) return
    const v = document.querySelector<HTMLVideoElement>(
      ".media-default-skin video"
    )
    if (!v) return

    const currentIdx = qualityOptions.findIndex((o) => o.id === url)
    if (currentIdx === -1) return // mirror/interstitial source — skip

    const trySwitch = (idx: number) => {
      if (Date.now() - lastSwitchRef.current < 5000) return
      const target = qualityOptions[idx]
      if (!target || target.id === url) return
      lastSwitchRef.current = Date.now()
      stallRef.current = { count: 0, windowStart: 0 }
      healthySinceRef.current = null
      if (v && Number.isFinite(v.currentTime))
        resumeAtRef.current = v.currentTime
      setResolveAttempt(0)
      onUrlChangeRef.current?.(target.id)
    }

    const onWaiting = () => {
      const now = Date.now()
      if (now - stallRef.current.windowStart > 10_000) {
        stallRef.current = { count: 0, windowStart: now }
      }
      stallRef.current.count += 1
      if (
        stallRef.current.count >= 3 &&
        currentIdx < qualityOptions.length - 1
      ) {
        trySwitch(currentIdx + 1)
      }
    }
    const onPlaying = () => {
      if (healthySinceRef.current === null) healthySinceRef.current = Date.now()
      if (
        currentIdx > 0 &&
        Date.now() - healthySinceRef.current > 20_000 &&
        netTier() !== "low" &&
        Date.now() - lastSwitchRef.current > 15_000
      ) {
        trySwitch(currentIdx - 1)
      }
      stallRef.current.count = Math.max(0, stallRef.current.count - 1)
    }

    v.addEventListener("waiting", onWaiting)
    v.addEventListener("playing", onPlaying)
    return () => {
      v.removeEventListener("waiting", onWaiting)
      v.removeEventListener("playing", onPlaying)
      healthySinceRef.current = null
    }
  }, [playSrc, autoMode, url, qualityOptions])

  // Warm the resolve cache for sibling qualities once playback starts, so
  // later quality switches are instant instead of re-running the chain.
  const prefetchedKeyRef = useRef<string | null>(null)
  useEffect(() => {
    if (!playSrc || !videoUrl) return
    const siblings = (variants ?? [])
      .map((v) => v.url)
      .filter((u) => u !== videoUrl)
      .slice(0, 4)
    if (siblings.length === 0) return
    const key = `${videoUrl}|${siblings.join("|")}`
    if (prefetchedKeyRef.current === key) return
    prefetchedKeyRef.current = key

    const start = () => {
      for (const u of siblings) {
        fetch(`/api/resolve?url=${encodeURIComponent(u)}`).catch(() => {})
      }
    }
    const v = document.querySelector<HTMLVideoElement>(
      ".media-default-skin video"
    )
    if (v && v.readyState >= 2) {
      setTimeout(start, 1500) // let the current source grab bandwidth first
    } else {
      v?.addEventListener("playing", () => setTimeout(start, 1500), {
        once: true,
      })
    }
  }, [playSrc, videoUrl, variants])

  // Black-screen detector: some sources (x265/10-bit MKV rips) play audio
  // while the video codec silently fails — no error event is raised, so
  // the normal fallback chain never triggers. If playback starts but no
  // video frame (or zero dimensions) materializes, treat it as a failure.
  const handlerRef = useRef(handlePlayerError)
  useEffect(() => {
    handlerRef.current = handlePlayerError
  })
  useEffect(() => {
    if (!playSrc) return
    let cancelled = false
    let armed = false
    let gotFrame = false
    const v = document.querySelector<HTMLVideoElement>(
      ".media-default-skin video"
    )
    if (!v) return

    const fail = () => {
      if (!cancelled && !gotFrame) {
        cancelled = true
        handlerRef.current()
      }
    }
    const arm = () => {
      if (armed || cancelled) return
      armed = true
      if (v.videoWidth === 0) {
        // No decodable video track at all.
        setTimeout(fail, 400)
        return
      }
      const rvfc = (
        v as HTMLVideoElement & {
          requestVideoFrameCallback?: (cb: () => void) => number
        }
      ).requestVideoFrameCallback
      if (rvfc) {
        rvfc.call(v, () => {
          gotFrame = true
        })
        setTimeout(fail, 5000)
      }
      // Without requestVideoFrameCallback (Firefox) we rely on the
      // zero-dimension check and native error events.
    }

    // Source-level failures that never reach onError (manifest fetches
    // failing repeatedly, hung loads): if playback never reaches data,
    // terminate the chain.
    const stuckTimer = setTimeout(() => {
      if (!cancelled && !gotFrame && v.readyState < 2) fail()
    }, 10_000)

    v.addEventListener("loadedmetadata", arm)
    v.addEventListener("playing", arm)
    v.addEventListener("error", fail)
    return () => {
      cancelled = true
      clearTimeout(stuckTimer)
      v.removeEventListener("loadedmetadata", arm)
      v.removeEventListener("playing", arm)
      v.removeEventListener("error", fail)
    }
  }, [playSrc])

  // Restore the playback position after an in-player quality switch.
  useEffect(() => {
    if (!playSrc || resumeAtRef.current === null) return
    const resumeAt = resumeAtRef.current
    resumeAtRef.current = null
    const trySeek = () => {
      const v = document.querySelector<HTMLVideoElement>(
        ".media-default-skin video"
      )
      if (!v) return false
      v.currentTime = resumeAt
      return true
    }
    if (!trySeek()) {
      const t = setInterval(() => {
        if (trySeek()) clearInterval(t)
      }, 200)
      setTimeout(() => clearInterval(t), 8000)
    }
  }, [playSrc])

  // Ask the sidecar (via /api/subs) what subtitle and audio streams the
  // file carries. Dual-audio sources expose a switchable audio menu.
  useEffect(() => {
    if (!videoUrl || HLS_EXT.test(videoUrl)) return
    let cancelled = false
    fetch(`/api/subs?mode=list&url=${encodeURIComponent(videoUrl)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return

        if (data?.tracks?.length) {
          setSubs((prev) => [
            ...prev,
            ...data.tracks
              .filter((t: { index: number }) => typeof t.index === "number")
              .map(
                (t: { index: number; lang?: string; title?: string }) =>
                  ({
                    id: `emb-${t.index}-${Date.now()}`,
                    label: `Embedded · ${t.title || t.lang || `track ${t.index}`}`,
                    lang: t.lang || "und",
                    src: "", // extracted lazily when selected
                    embedded: true,
                    index: t.index,
                  }) satisfies SubtitleTrack
              ),
          ])
        }

        if (data?.audioTracks?.length > 1) {
          const opts = data.audioTracks.map(
            (a: { index: number; lang?: string; title?: string }) => ({
              id: String(a.index),
              label:
                a.title ||
                (a.lang && a.lang !== "und"
                  ? a.lang.toUpperCase()
                  : `Track ${a.index + 1}`),
            })
          )
          setAudioOptions([{ id: "default", label: "Original" }, ...opts])
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [videoUrl])

  async function handleSubtitleFiles(files: FileList | null) {
    const added = await filesToSubtitleTracks(files)
    if (added.length === 0) return
    setSubs((prev) => [
      ...prev,
      ...added.filter(
        (a) => !prev.some((p) => p.label === a.label && p.lang === a.lang)
      ),
    ])
  }

  // Extract an embedded track's cues through the sidecar on first use.
  async function ensureExtracted(
    trackId: string
  ): Promise<SubtitleTrack | null> {
    const track = subs.find((t) => t.id === trackId)
    if (!track?.embedded || track.src) return track ?? null
    setPendingSub(trackId)
    try {
      const r = await fetch(
        `/api/subs?mode=extract&url=${encodeURIComponent(videoUrl!)}&index=${track.index}`
      )
      if (!r.ok) throw new Error(String(r.status))
      const vtt = await r.text()
      const src = URL.createObjectURL(new Blob([vtt], { type: "text/vtt" }))
      let updated: SubtitleTrack | null = null
      setSubs((prev) =>
        prev.map((t) => {
          if (t.id !== trackId) return t
          updated = { ...t, src }
          return updated
        })
      )
      return updated
    } catch {
      return null
    } finally {
      setPendingSub(null)
    }
  }

  // The player's own captions radio group manages <track> modes; we watch
  // for selection changes so embedded streams can be extracted just in time
  // (their <track> element starts without a src).
  useEffect(() => {
    const v = document.querySelector<HTMLVideoElement>(
      ".media-default-skin video"
    )
    if (!v) return
    const tt = v.textTracks
    const onChange = () => {
      for (let i = 0; i < tt.length; i++) {
        const textTrack = tt[i]
        if (textTrack.mode !== "showing") continue
        const match = subs.find(
          (t) => t.embedded && !t.src && t.label === textTrack.label
        )
        if (match && !pendingSub) {
          void ensureExtracted(match.id).then((updated) => {
            if (updated?.src && v.isConnected) {
              // Re-show after React re-renders the track with its new src.
              setTimeout(() => {
                for (let j = 0; j < tt.length; j++) {
                  tt[j].mode =
                    tt[j].label === updated.label ? "showing" : "disabled"
                }
              }, 50)
            } else if (!updated) {
              textTrack.mode = "disabled"
            }
          })
        }
      }
    }
    tt.addEventListener("change", onChange)
    return () => tt.removeEventListener("change", onChange)
  })

  function handlePlayerError() {
    failureCountRef.current += 1
    const cap = Math.max(6, (variants?.length ?? 0) * 2 + 4)
    if (failureCountRef.current > cap) {
      setError(true)
      setResolving(false)
      return
    }
    const media = document.querySelector<HTMLVideoElement>(
      ".media-default-skin video"
    )
    // AbortError-class failures fire on every source swap; they are not
    // real playback problems.
    if (
      media?.error &&
      media.error.code === (media.error.MEDIA_ERR_ABORTED ?? 1)
    ) {
      return
    }

    const src = playSrc ?? ""
    // Tokenized /go source failed: try the next mirror type. The transmux
    // proxy can't handle redirecting tokenized URLs, so skip it here.
    if (src.includes("/go?")) {
      if (goIdx < goUrls.length - 1) {
        setGoIdx(goIdx + 1)
        setVideoUrl(goUrls[goIdx + 1])
        return
      }
      // Mirrors exhausted — descend through remaining catalog qualities.
      if (descendQuality()) return
    } else if (!useHlsProxy && videoUrl && !HLS_EXT.test(videoUrl)) {
      // Keep videoUrl: playSrc recomputes to the proxy URL and the key
      // change remounts the player in HLS mode immediately.
      setUseHlsProxy(true)
      return
    } else if (descendQuality()) {
      // Direct source failed even through the proxy: auto-switch to the
      // next-best catalog quality before giving up.
      return
    }
    // Resolved links can be short-lived or single-use; retry with a fresh
    // resolution before giving up. Mirror-only mode gets one round since
    // interstitial walls won't disappear on retry.
    const maxAttempts = goMode ? 1 : 2
    if (resolveAttempt >= maxAttempts) {
      setError(true)
      return
    }
    setVideoUrl(null)
    setResolving(true)
    setResolveAttempt((a) => a + 1)
  }

  if (!url) {
    return (
      <div className="flex aspect-video items-center justify-center bg-muted text-sm text-muted-foreground">
        Select a quality to start playback
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl">
        <div className="relative aspect-video w-full">
          {resolving && (
            <div
              role="status"
              aria-live="polite"
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black text-white"
            >
              <Loader2
                className="size-8 animate-spin text-primary"
                aria-hidden="true"
              />
            </div>
          )}
          {playSrc && !error && (
            <VideoSkin
              key={playSrc}
              src={playSrc}
              onError={handlePlayerError}
              className="absolute inset-0 h-full w-full"
              tracks={subs}
              extractingLabel={
                pendingSub
                  ? (subs.find((t) => t.id === pendingSub)?.label ?? null)
                  : null
              }
              onAddSubtitleFiles={handleSubtitleFiles}
              audioOptions={audioOptions}
              activeAudioId={activeAudioId}
              onAudioChange={handleAudioChange}
              qualities={menuQualities}
              activeQualityId={autoMode ? "auto" : url}
              onQualityChange={handleQualityMenu}
            />
          )}
          {error && (
            <iframe
              src={url}
              title={label ?? "Player"}
              allow="autoplay; fullscreen; encrypted-media"
              allowFullScreen
              className="absolute inset-0 h-full w-full"
            />
          )}
          {!resolving && !playSrc && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {label && (
          <Badge variant="secondary" className="gap-1">
            <Play className="size-3" aria-hidden="true" />
            {label}
          </Badge>
        )}
        {videoUrl && (
          <Badge variant="default" className="gap-1 bg-green-600">
            Streaming
          </Badge>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            navigator.clipboard.writeText(url)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
          className="gap-1"
        >
          {copied ? (
            <Check className="size-3.5" aria-hidden="true" />
          ) : (
            <Copy className="size-3.5" aria-hidden="true" />
          )}
          {copied ? "Copied" : "Copy link"}
        </Button>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-7 items-center gap-1 rounded-2xl border bg-background px-3 text-sm font-medium hover:bg-muted"
        >
          <ExternalLink className="size-3.5" aria-hidden="true" /> Open
          externally
        </a>
      </div>
    </div>
  )
}
