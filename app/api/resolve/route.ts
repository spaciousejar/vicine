import { NextRequest, NextResponse } from "next/server"

const WORKER_HOSTS = [".workers.dev"]
const FETCH_TIMEOUT_MS = 6000
const RESOLVE_BUDGET_MS = 9000
// Upstream signed links stay valid for hours; caching resolutions for 15
// minutes makes quality switches (and revisits) effectively instant.
const CACHE_TTL_MS = 900_000
// Failed resolutions are cached briefly: dead links stop being re-probed on
// every click, while genuinely transient upstream hiccups recover fast.
const NEGATIVE_TTL_MS = 180_000
const FAILED_PAYLOAD = { error: "Could not resolve a playable video URL" }

const NO_STORE = { cache: "no-store" } as RequestInit
// Upstream hosts (Cloudflare-fronted CDNs, Google) treat bare undici
// requests from datacenter IPs as bots; browser-like headers reduce
// challenge rates.
const BROWSER_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  accept: "*/*",
  "accept-language": "en-US,en;q=0.9",
} as HeadersInit

type Token = { ts?: string; sig?: string }

const resolveCache = new Map<string, { expires: number; payload: object }>()
const RESOLVE_CACHE_MAX = 500

function cachePut(key: string, payload: object, ttl = CACHE_TTL_MS) {
  if (resolveCache.size >= RESOLVE_CACHE_MAX) {
    const oldest = resolveCache.keys().next().value
    if (oldest !== undefined) resolveCache.delete(oldest)
  }
  resolveCache.set(key, { expires: Date.now() + ttl, payload })
}

function timedFetch(
  url: string,
  init?: RequestInit,
  timeoutMs: number = FETCH_TIMEOUT_MS
) {
  return fetch(url, {
    ...NO_STORE,
    headers: BROWSER_HEADERS,
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
  })
}

// Redirect targets are attacker-influenceable, so never let the chain point
// at loopback/private/link-local addresses (SSRF protection).
const BLOCKED_HOST_PATTERNS = [/^localhost$/i, /\.local$/i, /\.internal$/i]

function isPrivateIp(hostname: string): boolean {
  if (!/^[0-9.:]+$/.test(hostname)) return false
  if (
    hostname === "::1" ||
    hostname === "[::1]" ||
    hostname.startsWith("fc") ||
    hostname.startsWith("fd") ||
    hostname.startsWith("fe8")
  ) {
    return true
  }
  const parts = hostname.split(".").map((p) => parseInt(p, 10))
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true
  const [a, b] = parts
  if (a === 0 || a === 10 || a === 127) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a >= 224) return true
  return false
}

function isSafeHopUrl(url: string): boolean {
  try {
    const u = new URL(url)
    if (u.protocol !== "https:" && u.protocol !== "http:") return false
    if (u.username || u.password) return false
    const host = u.hostname.replace(/^\[|\]$/g, "")
    if (BLOCKED_HOST_PATTERNS.some((re) => re.test(host))) return false
    if (isPrivateIp(host)) return false
    return true
  } catch {
    return false
  }
}

function looksPlayable(
  status: number,
  contentType: string | null,
  contentLength: string | null
) {
  // 206 = ranged GET answered with real bytes.
  if (status !== 200 && status !== 206) return false
  if (/^text\/html/i.test(contentType ?? "")) return false
  if (contentLength === "0") return false
  return true
}

async function isPlayable(
  url: string,
  trace?: Record<string, unknown>[]
): Promise<boolean> {
  if (!isSafeHopUrl(url)) return false
  const probe: Record<string, unknown> = { candidate: url.slice(0, 90) }
  try {
    const res = await timedFetch(url, { method: "HEAD", redirect: "follow" })
    probe.headStatus = res.status
    probe.headCt = res.headers.get("content-type")
    if (
      looksPlayable(
        res.status,
        res.headers.get("content-type"),
        res.headers.get("content-length")
      )
    ) {
      trace?.push({ ...probe, verdict: "head-ok" })
      return true
    }
  } catch (e) {
    probe.headErr = String(e).slice(0, 90)
  }
  // Some CDNs reject HEAD from datacenter IPs outright but serve ranged
  // GETs fine — that response is the authoritative playability check.
  try {
    const res = await timedFetch(url, {
      method: "GET",
      headers: { range: "bytes=0-1023" },
      redirect: "follow",
    })
    probe.getStatus = res.status
    probe.getCt = res.headers.get("content-type")
    const ok = looksPlayable(
      res.status,
      res.headers.get("content-type"),
      res.headers.get("content-length")
    )
    trace?.push({ ...probe, verdict: ok ? "get-ok" : "get-reject" })
    return ok
  } catch (e) {
    trace?.push({
      ...probe,
      getErr: String(e).slice(0, 90),
      verdict: "get-err",
    })
    return false
  }
}

type ChainResult = { url: string; verified: boolean; fromDlphp?: boolean }

async function followChain(
  workerBase: string,
  type: string,
  vcloudUrl: string,
  token: Token
): Promise<ChainResult | null> {
  const goUrl = `${workerBase}/go?type=${type}&vcloud=${encodeURIComponent(
    vcloudUrl
  )}&ts=${token.ts}&sig=${token.sig}`

  let goRes: Response
  try {
    goRes = await timedFetch(goUrl, { redirect: "manual" })
  } catch {
    return null
  }
  if (goRes.status < 300 || goRes.status >= 400) return null

  let currentUrl: string | null = goRes.headers.get("location")
  if (!currentUrl) return null

  let status = goRes.status
  let contentType: string | null = goRes.headers.get("content-type")
  let contentLength: string | null = goRes.headers.get("content-length")

  for (let i = 0; i < 5; i++) {
    if (!isSafeHopUrl(currentUrl)) return null

    try {
      const hopUrl = new URL(currentUrl)
      if (hopUrl.pathname.endsWith("dl.php")) {
        const link = hopUrl.searchParams.get("link")
        // Extracted link hasn't been probed yet — caller must verify.
        if (link)
          // fromDlphp: trusted origin — skip playability probes.
          return isSafeHopUrl(link)
            ? { url: link, verified: false, fromDlphp: true }
            : null
      }
    } catch {}

    let hopRes: Response
    try {
      // GET instead of HEAD: hubcloud-class hosts 403 bare HEAD probes but
      // answer normal requests. Body is discarded immediately.
      hopRes = await timedFetch(currentUrl, {
        method: "GET",
        redirect: "manual",
      })
      try {
        await hopRes.body?.cancel()
      } catch {}
    } catch {
      break
    }

    status = hopRes.status
    contentType = hopRes.headers.get("content-type")
    contentLength = hopRes.headers.get("content-length")

    if (status >= 300 && status < 400) {
      const next = hopRes.headers.get("location")
      if (!next) break
      try {
        currentUrl = new URL(next, currentUrl).toString()
      } catch {
        break
      }
    } else {
      break
    }
  }

  if (!isSafeHopUrl(currentUrl)) return null
  return {
    url: currentUrl,
    verified: looksPlayable(status, contentType, contentLength),
  }
}

async function tryType(
  workerBase: string,
  type: string,
  vcloudUrl: string,
  token: Token,
  trace?: Record<string, unknown>[]
): Promise<string> {
  const result = await followChain(workerBase, type, vcloudUrl, token)
  if (!result) throw new Error(`chain failed for ${type}`)
  if (!result.verified && !result.fromDlphp) {
    if (!(await isPlayable(result.url, trace))) {
      throw new Error(`unplayable candidate for ${type}`)
    }
  }
  return result.url
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url")
  if (!url)
    return NextResponse.json({ error: "Missing url param" }, { status: 400 })

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 })
  }

  const host = parsed.hostname
  const isWorker = WORKER_HOSTS.some((h) => host.endsWith(h))
  const isVcloud = host === "vcloud.fit" || host.endsWith(".vcloud.fit")

  if (!isWorker && !isVcloud) {
    return NextResponse.json({ error: "Unsupported URL host" }, { status: 400 })
  }

  try {
    const workerBase = isWorker
      ? `${parsed.protocol}//${host}`
      : `https://quiet-lab-41f9.yolku.workers.dev`
    // The troprek worker's /api/links hangs indefinitely when called from
    // Vercel/AWS egress (upstream bot rules); the yolku worker serves the
    // identical vcloud API and answers fine, so route around it.
    const effectiveBase =
      isWorker && host.endsWith("troprek.workers.dev")
        ? `https://quiet-lab-41f9.yolku.workers.dev`
        : workerBase
    const vcloudUrl = isVcloud
      ? url
      : (parsed.searchParams.get("vcloud") ?? url)

    const cacheKey = `${effectiveBase}|${vcloudUrl}`
    // Diagnostics (link audits) set this to bypass both caches so every
    // probe reflects live upstream state instead of a previous verdict.
    const probing = req.headers.get("x-probe") === "1"
    if (!probing) {
      const cached = resolveCache.get(cacheKey)
      if (cached && cached.expires > Date.now()) {
        const isFailure = "error" in cached.payload
        return NextResponse.json(cached.payload, {
          status: isFailure ? 502 : 200,
        })
      }
    }

    let title: unknown
    let size: unknown
    // ?debug=1 attaches per-attempt evidence to the failure payload so
    // environment-specific breakage (e.g. egress differences) is visible.
    const wantsDebug = req.nextUrl.searchParams.get("debug") === "1"
    // Trace exposes internal topology; in production require the secret.
    const debug =
      wantsDebug &&
      (process.env.NODE_ENV !== "production" ||
        (process.env.DEBUG_KEY !== undefined &&
          req.headers.get("x-debug-key") === process.env.DEBUG_KEY))
    const trace: Record<string, unknown>[] = []

    // Preferred path: delegate the whole chain to a Cloudflare Worker
    // (RESOLVE_WORKER_URL). Upstream hosts block most datacenter egress,
    // but a worker on a custom domain sometimes passes where platforms
    // can't. On failure we fall through to the local chain and finally the
    // browser-traversed /go fallback.
    const sidecar = process.env.SUBS_SIDECAR_URL
    if (sidecar) {
      try {
        const res2 = await timedFetch(
          `${sidecar.replace(/\/+$/, "")}/resolve?url=${encodeURIComponent(url)}${debug ? "&debug=1" : ""}`,
          undefined,
          RESOLVE_BUDGET_MS + 2000
        )
        const data = (await res2.json()) as {
          videoUrl?: string
          title?: unknown
          size?: unknown
        }
        if (res2.ok && data.videoUrl) {
          const payload = {
            videoUrl: data.videoUrl,
            title: data.title,
            size: data.size,
          }
          cachePut(cacheKey, payload)
          return NextResponse.json(payload)
        }
      } catch {
        // sidecar resolver unreachable — fall through
      }
    }

    const remoteBase = process.env.RESOLVE_WORKER_URL
    if (remoteBase) {
      try {
        const remote = await timedFetch(
          `${remoteBase.replace(/\/+$/, "")}/resolve?url=${encodeURIComponent(url)}${debug ? "&debug=1" : ""}`,
          undefined,
          RESOLVE_BUDGET_MS + 2000
        )
        const data = (await remote.json()) as {
          videoUrl?: string
          title?: unknown
          size?: unknown
          error?: string
          trace?: Record<string, unknown>[]
        }
        if (remote.ok && data.videoUrl) {
          const payload = {
            videoUrl: data.videoUrl,
            title: data.title,
            size: data.size,
          }
          cachePut(cacheKey, payload)
          return NextResponse.json(payload)
        }
        if (data.trace)
          trace.push(...data.trace.map((t) => ({ ...t, via: "worker" })))
      } catch {
        // Worker unreachable — fall through to the legacy local chain.
      }
    }

    // Tokens can be single-use or short-lived. Each attempt races every
    // server type in parallel and returns the first verified URL. A
    // wall-clock budget keeps worst-case latency bounded instead of
    // stacking full retry rounds.
    const deadline = Date.now() + RESOLVE_BUDGET_MS

    for (let attempt = 0; attempt < 3; attempt++) {
      const remaining = deadline - Date.now()
      if (remaining <= 0) break

      // The links endpoint can hang or hiccup on dead ids; treat any
      // per-attempt failure as retryable instead of letting it escape.
      let linksData: {
        title?: unknown
        size?: unknown
        tokens?: Record<string, Token>
      }
      try {
        const t0 = Date.now()
        const linksRes = await timedFetch(
          `${effectiveBase}/api/links?vcloud=${encodeURIComponent(vcloudUrl)}`,
          undefined,
          Math.min(FETCH_TIMEOUT_MS, remaining)
        )
        if (!linksRes.ok) {
          if (debug)
            trace.push({
              step: "links",
              status: linksRes.status,
              ct: linksRes.headers.get("content-type"),
              ms: Date.now() - t0,
            })
          continue
        }
        linksData = await linksRes.json()
      } catch (e) {
        if (debug)
          trace.push({
            step: "links",
            error: String(e).slice(0, 120),
            ms: Date.now() - (deadline - RESOLVE_BUDGET_MS),
          })
        continue
      }

      title = linksData.title
      size = linksData.size

      const tokens: Record<string, Token> = linksData.tokens ?? {}
      const types = Object.keys(tokens).filter(
        (t) => tokens[t]?.ts && tokens[t]?.sig
      )
      if (debug && types.length === 0)
        trace.push({ step: "tokens", empty: true })

      // First success wins immediately — a slow dying mirror (e.g. a 404
      // that takes 4s to answer) must not delay a healthy sibling chain.
      let winnerUrl: string | null = null
      try {
        winnerUrl = await new Promise<string>((resolve, reject) => {
          const attempts = types.map((type) =>
            tryType(effectiveBase, type, vcloudUrl, tokens[type], trace)
          )
          let pending = attempts.length
          if (pending === 0) {
            reject(new Error("no candidates"))
            return
          }
          attempts.forEach((p, i) => {
            p.then(resolve).catch((e) => {
              pending -= 1
              if (debug)
                trace.push({
                  step: `chain:${types[i]}`,
                  error: String(e).slice(0, 140),
                })
              if (pending === 0) reject(new Error("all chains failed"))
            })
          })
        })
      } catch {
        // Every chain failed this attempt — fall through to the retry
        // loop / final fallback below.
      }

      if (winnerUrl) {
        const payload = { videoUrl: winnerUrl, title, size }
        cachePut(cacheKey, payload)
        return NextResponse.json(payload)
      }

      if (Date.now() >= deadline) break
    }

    // Last resort: hand the browser a tokenized /go URL. Upstream hosts
    // 403 every datacenter egress we have (Vercel, CF Workers), so let the
    // user's own connection traverse the redirect chain inside <video>.
    try {
      const linksRes = await timedFetch(
        `${effectiveBase}/api/links?vcloud=${encodeURIComponent(vcloudUrl)}`,
        undefined,
        FETCH_TIMEOUT_MS
      )
      if (linksRes.ok) {
        const data = await linksRes.json()
        const tokens: Record<string, Token> = data.tokens ?? {}
        const usable = Object.entries(tokens).filter(
          ([, t]) => t?.ts && t?.sig
        ) as [string, Token][]
        if (usable.length > 0) {
          const mkGo = ([type, t]: [string, Token]) =>
            `${effectiveBase}/go?type=${type}` +
            `&vcloud=${encodeURIComponent(vcloudUrl)}` +
            `&ts=${t.ts}&sig=${t.sig}`
          const payload = {
            goUrl: mkGo(usable[0]),
            // Some server types (e.g. pixeldrain mirrors) can be dead while
            // others work — hand every option over so the player can walk
            // them on playback errors.
            goUrls: usable.map(([type, t]) => ({ type, url: mkGo([type, t]) })),
            title: data.title,
            size: data.size,
          }
          // Tokens are single-use/short-lived: a long TTL here would serve
          // dead links from cache long after the signatures expired.
          cachePut(cacheKey, payload, 45_000)
          return NextResponse.json(payload)
        }
      }
    } catch {}

    // True last resort: the upstream worker's /api/links endpoint blocked
    // datacenter egress too, so we couldn't fetch tokens. Return the
    // original URL directly — the browser (on a residential IP) CAN reach
    // the worker and traverse the redirect chain itself.
    if (isSafeHopUrl(url)) {
      const fallbackPayload = {
        goUrl: url,
        goUrls: [{ type: "direct", url }],
      }
      if (!probing) cachePut(cacheKey, fallbackPayload, 45_000)
      return NextResponse.json(fallbackPayload)
    }

    // Negative-cache so repeat clicks on a dead link fail fast instead of
    // re-running the full chain for the next few minutes. Probe-bypassed
    // audits must not poison real-user caches.
    if (!probing) cachePut(cacheKey, FAILED_PAYLOAD, NEGATIVE_TTL_MS)
    return NextResponse.json(
      debug ? { ...FAILED_PAYLOAD, trace } : FAILED_PAYLOAD,
      { status: 502 }
    )
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
