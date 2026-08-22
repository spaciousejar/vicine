import { NextRequest, NextResponse } from "next/server"

// Proxy to the subtitle/audio sidecar (SUBS_SIDECAR_URL, e.g. a home box
// running sidecar/subs-server.mjs behind a tunnel). Proxying keeps the
// origin private; extraction/remux needs ffmpeg, which serverless lacks.

export const maxDuration = 300 // subtitle extraction reads the whole remote file

const SIDECAR = process.env.SUBS_SIDECAR_URL?.replace(/\/+$/, "")
const TIMEOUT_MS = 290_000

// Media hosts we resolve to / stream from. Anything else is rejected so
// the proxy endpoints cannot be used as an SSRF primitive into private
// networks. Extend as new CDNs appear in resolved links.
const MEDIA_HOST_RE = new RegExp(
  "(^|\\.)(" +
    [
      "vcloud.fit",
      "workers.dev",
      "googleusercontent.com",
      "r2.dev",
      "hicine.sbs",
    ].join("|") +
    ")$",
  "i"
)

function isAllowedTarget(raw: string): boolean {
  try {
    const u = new URL(raw)
    if (u.protocol !== "https:" && u.protocol !== "http:") return false
    return MEDIA_HOST_RE.test(u.hostname)
  } catch {
    return false
  }
}

export async function GET(req: NextRequest) {
  if (!SIDECAR) {
    // No extractor configured: report gracefully so the player stays quiet.
    return NextResponse.json({ available: false, tracks: [], audioTracks: [] })
  }

  const mode = req.nextUrl.searchParams.get("mode") || "list"
  const url = req.nextUrl.searchParams.get("url")
  if (!url || !isAllowedTarget(url)) {
    return NextResponse.json({ error: "url not allowed" }, { status: 403 })
  }
  const index = req.nextUrl.searchParams.get("index") ?? "0"

  const target =
    mode === "extract"
      ? `${SIDECAR}/extract?url=${encodeURIComponent(url)}&index=${index}`
      : mode === "audio"
        ? `${SIDECAR}/audio?url=${encodeURIComponent(url)}&index=${index}`
        : `${SIDECAR}/list?url=${encodeURIComponent(url)}`

  try {
    const upstream = await fetch(target, {
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    if (mode === "list") {
      const data = await upstream.json().catch(() => null)
      return NextResponse.json(data ?? { tracks: [], audioTracks: [] }, {
        status: upstream.ok ? 200 : upstream.status,
      })
    }

    if (mode === "audio") {
      // Stream the remuxed fMP4 through untouched.
      if (!upstream.ok || !upstream.body) {
        return NextResponse.json(
          { error: "remux failed" },
          { status: upstream.status }
        )
      }
      return new NextResponse(upstream.body, {
        status: 200,
        headers: {
          "content-type": "video/mp4",
          "cache-control": "no-store",
        },
      })
    }

    // subtitles (extract)
    if (!upstream.ok) {
      return NextResponse.json(
        { error: "extraction failed" },
        { status: upstream.status }
      )
    }
    const vtt = await upstream.text()
    return new NextResponse(vtt, {
      status: 200,
      headers: {
        "content-type": "text/vtt",
        "cache-control": "public, max-age=86400",
      },
    })
  } catch {
    return NextResponse.json({ error: "sidecar unreachable" }, { status: 504 })
  }
}
