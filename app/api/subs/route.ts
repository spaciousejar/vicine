import { NextRequest, NextResponse } from "next/server"

// Proxy to the subtitle/audio sidecar (SUBS_SIDECAR_URL, e.g. a home box
// running sidecar/subs-server.mjs behind a tunnel). Proxying keeps the
// origin private; extraction/remux needs ffmpeg, which serverless lacks.

const SIDECAR = process.env.SUBS_SIDECAR_URL?.replace(/\/+$/, "")
const TIMEOUT_MS = 150_000 // extracting a big remote file can take a while

export async function GET(req: NextRequest) {
  if (!SIDECAR) {
    // No extractor configured: report gracefully so the player stays quiet.
    return NextResponse.json({ available: false, tracks: [], audioTracks: [] })
  }

  const mode = req.nextUrl.searchParams.get("mode") || "list"
  const url = req.nextUrl.searchParams.get("url")
  if (!url || !/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: "missing url" }, { status: 400 })
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
