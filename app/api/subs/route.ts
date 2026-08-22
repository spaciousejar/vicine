import { NextRequest, NextResponse } from "next/server"

// Proxy to the subtitle sidecar (SUBS_SIDECAR_URL, e.g. a home box running
// sidecar/subs-server.mjs behind a tunnel). Proxying keeps the origin
// private; extraction itself needs ffmpeg, which serverless lacks.

const SIDECAR = process.env.SUBS_SIDECAR_URL?.replace(/\/+$/, "")
const TIMEOUT_MS = 150_000 // extraction of a big remote file can take a while

export async function GET(req: NextRequest) {
  if (!SIDECAR) {
    // No extractor configured: report gracefully so the player stays quiet.
    return NextResponse.json({ available: false, tracks: [] })
  }

  const mode = req.nextUrl.searchParams.get("mode") || "list"
  const url = req.nextUrl.searchParams.get("url")
  if (!url || !/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: "missing url" }, { status: 400 })
  }

  const target =
    mode === "extract"
      ? `${SIDECAR}/extract?url=${encodeURIComponent(url)}&index=${req.nextUrl.searchParams.get("index") ?? "0"}`
      : `${SIDECAR}/list?url=${encodeURIComponent(url)}`

  try {
    const upstream = await fetch(target, {
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    if (mode === "list") {
      const data = await upstream.json().catch(() => null)
      return NextResponse.json(data ?? { tracks: [] }, {
        status: upstream.ok ? 200 : upstream.status,
      })
    }

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
