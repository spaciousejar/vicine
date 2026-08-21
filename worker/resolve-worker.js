/**
 * vicine resolve worker — runs the full vcloud link-resolution chain from
 * inside Cloudflare's network, where upstream hosts (vcloud.fit, hubcloud,
 * googleusercontent) don't block or challenge datacenter-style egress.
 *
 * Deploy: dash.cloudflare.com → Workers & Pages → Create Worker → paste this
 * file → Deploy. Then in Vercel set RESOLVE_WORKER_URL=https://<worker-host>
 * and redeploy.
 *
 * Endpoints:
 *   GET /resolve?url=<vcloud.fit/<id> | <worker>/?vcloud=...>[&debug=1]
 *   GET /health
 */

const FETCH_TIMEOUT_MS = 8000

const BROWSER_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  accept: "*/*",
  "accept-language": "en-US,en;q=0.9",
}

const CORS = {
  "access-control-allow-origin": "*",
  "content-type": "application/json",
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: CORS })
}

function timedFetch(url, init) {
  return fetch(url, {
    cache: "no-store",
    headers: BROWSER_HEADERS,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    ...init,
  })
}

function isSafeHopUrl(url) {
  try {
    const u = new URL(url)
    if (u.protocol !== "https:" && u.protocol !== "http:") return false
    if (u.username || u.password) return false
    return true
  } catch {
    return false
  }
}

function looksPlayable(res) {
  if (res.status !== 200) return false
  if (/^text\/html/i.test(res.headers.get("content-type") ?? "")) return false
  return true
}

async function isPlayable(url) {
  if (!isSafeHopUrl(url)) return false
  try {
    const res = await timedFetch(url, { method: "HEAD", redirect: "follow" })
    // Some CDNs reject HEAD outright; a ranged GET is the authoritative check.
    if (!looksPlayable(res)) {
      const g = await timedFetch(url, {
        method: "GET",
        headers: { range: "bytes=0-1023" },
        redirect: "follow",
      })
      try {
        g.body?.cancel()
      } catch {}
      return looksPlayable(g)
    }
    return true
  } catch {
    return false
  }
}

async function followChain(workerBase, type, vcloudUrl, token, trace) {
  const goUrl =
    `${workerBase}/go?type=${type}&vcloud=${encodeURIComponent(vcloudUrl)}` +
    `&ts=${token.ts}&sig=${token.sig}`

  let goRes
  try {
    goRes = await timedFetch(goUrl, { redirect: "manual" })
  } catch (e) {
    trace?.push({ step: `go:${type}`, error: String(e).slice(0, 120) })
    return null
  }
  if (goRes.status < 300 || goRes.status >= 400) {
    trace?.push({ step: `go:${type}`, status: goRes.status })
    return null
  }

  let currentUrl = goRes.headers.get("location")
  if (!currentUrl || !isSafeHopUrl(currentUrl)) return null

  for (let i = 0; i < 6; i++) {
    const hopUrl = new URL(currentUrl)
    if (hopUrl.pathname.endsWith("dl.php")) {
      const link = hopUrl.searchParams.get("link")
      if (link)
        return isSafeHopUrl(link) ? { url: link, verified: false } : null
    }

    let hopRes
    try {
      hopRes = await timedFetch(currentUrl, {
        method: "HEAD",
        redirect: "manual",
      })
    } catch (e) {
      trace?.push({ step: `hop:${i}`, error: String(e).slice(0, 120) })
      break
    }

    if (hopRes.status >= 300 && hopRes.status < 400) {
      const next = hopRes.headers.get("location")
      if (!next) break
      currentUrl = new URL(next, currentUrl).toString()
      if (!isSafeHopUrl(currentUrl)) return null
      continue
    }

    return { url: currentUrl, verified: looksPlayable(hopRes) }
  }

  return null
}

export default {
  async fetch(req) {
    const { pathname, searchParams } = new URL(req.url)

    if (req.method === "OPTIONS") return new Response(null, { headers: CORS })

    if (pathname === "/health") return json({ ok: true })

    if (pathname === "/resolve") {
      const url = searchParams.get("url")
      const debug = searchParams.get("debug") === "1"
      if (!url) return json({ error: "Missing url param" }, 400)

      let parsed
      try {
        parsed = new URL(url)
      } catch {
        return json({ error: "Invalid URL" }, 400)
      }

      const host = parsed.hostname
      const isWorker = host.endsWith(".workers.dev")
      const isVcloud = host.includes("vcloud.fit")
      if (!isWorker && !isVcloud)
        return json({ error: "Unsupported host" }, 400)

      const workerBase = isWorker
        ? `${parsed.protocol}//${host}`
        : "https://quiet-lab-41f9.yolku.workers.dev"
      const vcloudUrl = isVcloud
        ? url
        : (parsed.searchParams.get("vcloud") ?? url)

      const trace = debug ? [] : undefined

      // Both known resolver workers serve identical vcloud APIs; some
      // vantage points get tokenless answers from one but not the other.
      const bases = [
        workerBase,
        workerBase.includes("yolku")
          ? "https://small-union-7439.troprek.workers.dev"
          : "https://quiet-lab-41f9.yolku.workers.dev",
      ].filter((b, i, a) => a.indexOf(b) === i)

      for (let attempt = 0; attempt < 3; attempt++) {
        const base = bases[attempt % bases.length]
        let linksData
        try {
          const res = await timedFetch(
            `${base}/api/links?vcloud=${encodeURIComponent(vcloudUrl)}`
          )
          if (!res.ok) {
            trace?.push({ step: "links", base, status: res.status })
            continue
          }
          linksData = await res.json()
        } catch (e) {
          trace?.push({ step: "links", base, error: String(e).slice(0, 140) })
          continue
        }

        const tokens = linksData.tokens ?? {}
        const types = Object.keys(tokens).filter(
          (t) => tokens[t]?.ts && tokens[t]?.sig
        )
        if (debug)
          trace?.push({
            step: "links-ok",
            base,
            typeKeys: Object.keys(tokens),
            usableTypes: types,
            bodyHead: JSON.stringify(linksData).slice(0, 200),
          })

        const results = await Promise.allSettled(
          types.map(async (type) => {
            const r = await followChain(
              base,
              type,
              vcloudUrl,
              tokens[type],
              trace
            )
            if (!r) throw new Error(`chain failed for ${type}`)
            if (!r.verified && !(await isPlayable(r.url)))
              throw new Error(`unplayable candidate for ${type}`)
            return r.url
          })
        )
        const winner = results.find((r) => r.status === "fulfilled")
        if (winner)
          return json({
            videoUrl: winner.value,
            title: linksData.title,
            size: linksData.size,
          })
        results.forEach((r, i) => {
          if (r.status === "rejected")
            trace?.push({
              step: `chain:${types[i]}`,
              error: String(r.reason).slice(0, 140),
            })
        })

        if (debug) trace?.push({ step: "attempt", done: attempt + 1 })
      }

      return json(
        debug
          ? { error: "Could not resolve", trace }
          : { error: "Could not resolve a playable video URL" },
        502
      )
    }

    return json({ error: "Not found" }, 404)
  },
}
