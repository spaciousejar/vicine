import { NextRequest, NextResponse } from "next/server"

const WORKER_HOSTS = [".workers.dev"]
const FETCH_TIMEOUT_MS = 6000
const RESOLVE_BUDGET_MS = 9000
const CACHE_TTL_MS = 60_000
// Failed resolutions are cached briefly: dead links stop being re-probed on
// every click, while genuinely transient upstream hiccups recover fast.
const NEGATIVE_TTL_MS = 180_000
const FAILED_PAYLOAD = { error: "Could not resolve a playable video URL" }

const NO_STORE = { cache: "no-store" } as RequestInit

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
  if (status !== 200) return false
  if (/^text\/html/i.test(contentType ?? "")) return false
  if (contentLength === "0") return false
  return true
}

async function isPlayable(url: string): Promise<boolean> {
  if (!isSafeHopUrl(url)) return false
  try {
    const res = await timedFetch(url, { method: "HEAD", redirect: "follow" })
    return looksPlayable(
      res.status,
      res.headers.get("content-type"),
      res.headers.get("content-length")
    )
  } catch {
    return false
  }
}

type ChainResult = { url: string; verified: boolean }

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
          return isSafeHopUrl(link) ? { url: link, verified: false } : null
      }
    } catch {}

    let hopRes: Response
    try {
      hopRes = await timedFetch(currentUrl, {
        method: "HEAD",
        redirect: "manual",
      })
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
  token: Token
): Promise<string> {
  const result = await followChain(workerBase, type, vcloudUrl, token)
  if (!result) throw new Error(`chain failed for ${type}`)
  if (!result.verified && !(await isPlayable(result.url))) {
    throw new Error(`unplayable candidate for ${type}`)
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
  const isWorker = WORKER_HOSTS.some((h) => host.includes(h))
  const isVcloud = host.includes("vcloud.fit")

  if (!isWorker && !isVcloud) {
    return NextResponse.json({ error: "Unsupported URL host" }, { status: 400 })
  }

  try {
    const workerBase = isWorker
      ? `${parsed.protocol}//${host}`
      : `https://quiet-lab-41f9.yolku.workers.dev`
    const vcloudUrl = isVcloud
      ? url
      : (parsed.searchParams.get("vcloud") ?? url)

    const cacheKey = `${workerBase}|${vcloudUrl}`
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
        const linksRes = await timedFetch(
          `${workerBase}/api/links?vcloud=${encodeURIComponent(vcloudUrl)}`,
          undefined,
          Math.min(FETCH_TIMEOUT_MS, remaining)
        )
        if (!linksRes.ok) continue
        linksData = await linksRes.json()
      } catch {
        continue
      }

      title = linksData.title
      size = linksData.size

      const tokens: Record<string, Token> = linksData.tokens ?? {}
      const types = Object.keys(tokens).filter(
        (t) => tokens[t]?.ts && tokens[t]?.sig
      )

      const payload = await Promise.any(
        types.map((type) => tryType(workerBase, type, vcloudUrl, tokens[type]))
      )
        .then((videoUrl) => ({ videoUrl, title, size }))
        .catch(() => null)

      if (payload) {
        cachePut(cacheKey, payload)
        return NextResponse.json(payload)
      }

      if (Date.now() >= deadline) break
    }

    // Negative-cache so repeat clicks on a dead link fail fast instead of
    // re-running the full chain for the next few minutes.
    cachePut(cacheKey, FAILED_PAYLOAD, NEGATIVE_TTL_MS)
    return NextResponse.json(FAILED_PAYLOAD, { status: 502 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
