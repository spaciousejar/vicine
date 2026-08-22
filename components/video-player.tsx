"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import Player from "next-video/player"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ExternalLink, Play, Copy, Check, Loader2 } from "lucide-react"

const HLS_EXT = /\.m3u8($|\?)/i

export function VideoPlayer({
  url,
  label,
  onUnresolved,
}: {
  url: string | null
  label?: string
  // Fired when resolution ultimately fails for this url (after retries) so
  // parents can mark the source as unavailable.
  onUnresolved?: (url: string) => void
}) {
  const [copied, setCopied] = useState(false)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [resolving, setResolving] = useState(Boolean(url))
  const [error, setError] = useState(false)
  const [resolveAttempt, setResolveAttempt] = useState(0)
  const [useHlsProxy, setUseHlsProxy] = useState(false)

  const [prevUrl, setPrevUrl] = useState(url)
  // Keep the latest callback in a ref so the resolve effect doesn't re-run
  // when parents pass a fresh inline function each render.
  const onUnresolvedRef = useRef(onUnresolved)
  useEffect(() => {
    onUnresolvedRef.current = onUnresolved
  })
  if (url !== prevUrl) {
    setPrevUrl(url)
    setVideoUrl(null)
    setError(false)
    setResolving(Boolean(url))
    setResolveAttempt(0)
    setUseHlsProxy(false)
  }

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
        // videoUrl = server-verified direct file. goUrl = tokenized hop URL
        // the browser itself must traverse (upstreams block datacenter IPs,
        // so the server cannot follow the chain).
        const src: string | undefined = data.videoUrl || data.goUrl
        if (src) {
          setVideoUrl(src)
          setResolving(false)
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

    resolve(1)

    return () => {
      cancelled = true
    }
  }, [url, resolveAttempt])

  // Firefox/Safari cannot demux MKV natively while Chrome tolerates it.
  // Route non-HLS sources through the server-side transmux proxy when the
  // browser reports a playback error on the direct file.
  const playSrc = useMemo(() => {
    if (!videoUrl) return null
    if (HLS_EXT.test(videoUrl)) return videoUrl
    if (!useHlsProxy) return videoUrl
    return `/api/stream/direct/index.m3u8?url=${encodeURIComponent(videoUrl)}`
  }, [videoUrl, useHlsProxy])

  function handlePlayerError() {
    if (!useHlsProxy && videoUrl && !HLS_EXT.test(videoUrl)) {
      // Keep videoUrl: playSrc recomputes to the proxy URL and the key
      // change remounts the player in HLS mode immediately.
      setUseHlsProxy(true)
      return
    }
    // Resolved links can be short-lived or single-use; retry with a fresh
    // resolution before giving up.
    if (resolveAttempt >= 2) {
      setError(true)
      return
    }
    setVideoUrl(null)
    setResolving(true)
    setResolveAttempt((a) => a + 1)
  }

  if (!url) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-xl border bg-muted text-sm text-muted-foreground">
        Select a quality to start playback
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border bg-black">
        <div className="relative aspect-video w-full">
          {resolving && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black text-white">
              <Loader2 className="size-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Resolving video link…
              </p>
            </div>
          )}
          {playSrc && (
            <Player
              key={playSrc}
              src={playSrc}
              autoPlay
              controls
              crossOrigin={undefined}
              onError={handlePlayerError}
              className="h-full w-full"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                backgroundColor: "black",
              }}
            />
          )}
          {error && (
            <iframe
              src={url}
              title={label ?? "Player"}
              allow="autoplay; fullscreen; encrypted-media"
              allowFullScreen
              className="absolute inset-0 h-full w-full border-0"
            />
          )}
          {!resolving && !videoUrl && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {label && (
          <Badge variant="secondary" className="gap-1">
            <Play className="size-3" />
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
            <Check className="size-3.5" />
          ) : (
            <Copy className="size-3.5" />
          )}
          {copied ? "Copied" : "Copy link"}
        </Button>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-7 items-center gap-1 rounded-2xl border bg-background px-3 text-sm font-medium hover:bg-muted"
        >
          <ExternalLink className="size-3.5" /> Open externally
        </a>
      </div>
      <p className="text-xs break-all text-muted-foreground">{url}</p>
    </div>
  )
}
