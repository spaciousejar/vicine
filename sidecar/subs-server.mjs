#!/usr/bin/env node
// vicine subtitle sidecar — runs on any machine with ffmpeg + ffprobe that
// can reach the video hosts (residential ISP passes where datacenters are
// blocked). Zero dependencies.
//
//   node sidecar/subs-server.mjs            # listens on :7777
//   PORT=9000 node sidecar/subs-server.mjs
//
// Endpoints (all CORS-open; put nothing sensitive here):
//   GET /health
//   GET /list?url=<video-url>            -> { tracks, audioTracks }
//   GET /extract?url=<video-url>&index=0 -> text/vtt   (subtitle track)
//   GET /audio?url=<video-url>&index=0   -> video/mp4 fMP4 stream with the
//                                           selected audio track remuxed
//                                           (video copied, no re-encode)
//
// Extracted subtitles are cached on disk under os.tmpdir()/vicine-subs.
// Audio remux streams are NOT cached — they pipe live.

import http from "node:http"
import { execFileFile } from "./lib/exec.mjs"
import { spawn } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import crypto from "node:crypto"

const PORT = Number(process.env.PORT || 7777)
const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg"
const FFPROBE = process.env.FFPROBE_PATH || "ffprobe"
const TIMEOUT_MS = 120_000
const CACHE_DIR = path.join(os.tmpdir(), "vicine-subs")
fs.mkdirSync(CACHE_DIR, { recursive: true })

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"

function cors(res, type = "application/json") {
  res.writeHead(200, {
    "access-control-allow-origin": "*",
    "content-type": type,
  })
}

function fail(res, status, message) {
  res.writeHead(status, {
    "access-control-allow-origin": "*",
    "content-type": "application/json",
  })
  res.end(JSON.stringify({ error: message }))
}

function safeUrl(u) {
  try {
    const parsed = new URL(u)
    if (!/^https?:$/.test(parsed.protocol)) return null
    return parsed.toString()
  } catch {
    return null
  }
}

function cachePath(url, index) {
  const hash = crypto.createHash("sha1").update(`${url}|${index}`).digest("hex")
  return path.join(CACHE_DIR, `${hash}.vtt`)
}

async function probe(url, select = "s") {
  const args = [
    "-v",
    "quiet",
    "-user_agent",
    BROWSER_UA,
    "-print_format",
    "json",
    "-show_streams",
    "-select_streams",
    select,
    url,
  ]
  const stdout = await execFileFile(FFPROBE, args, { timeout: TIMEOUT_MS })
  const parsed = JSON.parse(stdout)
  return (parsed.streams || []).map((s) => ({
    index: s.index,
    lang: s.tags?.language || "und",
    title: s.tags?.title || "",
    codec: s.codec_name,
    channels: s.channels,
  }))
}

// Remux video + the selected audio track into a fragmented MP4 stream.
// Stream-copy (-c copy) keeps startup fast and CPU idle; the fMP4 header
// is written up-front so browsers can begin playback immediately.
async function remuxAudio(url, audioIndex, res) {
  res.writeHead(200, {
    "access-control-allow-origin": "*",
    "content-type": "video/mp4",
    "cache-control": "no-store",
  })
  const child = spawn(
    FFMPEG,
    [
      "-nostdin",
      "-user_agent",
      BROWSER_UA,
      "-i",
      url,
      "-map",
      "0:v:0",
      "-map",
      `0:a:${audioIndex}`,
      "-c",
      "copy",
      "-movflags",
      "frag_keyframe+empty_moov",
      "-f",
      "mp4",
      "pipe:1",
    ],
    { stdio: ["ignore", "pipe", "ignore"] }
  )
  child.stdout.pipe(res)
  // Stop ffmpeg if the client disconnects.
  res.on("close", () => child.kill("SIGKILL"))
}

async function extract(url, index, res) {
  const cached = cachePath(url, index)
  if (fs.existsSync(cached)) {
    cors(res, "text/vtt")
    fs.createReadStream(cached).pipe(res)
    return
  }
  const tmp = `${cached}.${process.pid}.part`
  const args = [
    "-nostdin",
    "-user_agent",
    BROWSER_UA,
    "-i",
    url,
    "-map",
    `0:${index}`,
    "-f",
    "webvtt",
    "-y",
    tmp,
  ]
  try {
    await execFileFile(FFMPEG, args, { timeout: TIMEOUT_MS })
  } catch (e) {
    fail(res, 502, String(e.message || e).slice(0, 200))
    return
  }
  if (!fs.existsSync(tmp)) {
    // ffmpeg exits 0 with empty output when the track has no cues
    fail(res, 404, "no subtitle data")
    return
  }
  fs.renameSync(tmp, cached)
  cors(res, "text/vtt")
  fs.createReadStream(cached).pipe(res)
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x")
  const pathname = u.pathname

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,OPTIONS",
    })
    return res.end()
  }

  try {
    if (pathname === "/health") return (cors(res), res.end('{"ok":true}'))

    const url = safeUrl(u.searchParams.get("url") || "")
    if (!url) return fail(res, 400, "missing or invalid url")

    if (pathname === "/list") {
      // Subtitle streams and audio streams in one round-trip. Audio
      // entries carry their RELATIVE index among audio tracks (what
      // ffmpeg's `0:a:N` mapping expects).
      let tracks = []
      let audioTracks = []
      try {
        tracks = await probe(url, "s")
      } catch {}
      try {
        audioTracks = (await probe(url, "a")).map((a, relIdx) => ({
          ...a,
          index: relIdx,
        }))
      } catch {}
      cors(res)
      return res.end(JSON.stringify({ tracks, audioTracks }))
    }

    if (pathname === "/extract") {
      const index = Number.parseInt(u.searchParams.get("index") || "", 10)
      if (!Number.isInteger(index) || index < 0)
        return fail(res, 400, "bad index")
      return await extract(url, index, res)
    }

    if (pathname === "/audio") {
      const index = Number.parseInt(u.searchParams.get("index") || "", 10)
      if (!Number.isInteger(index) || index < 0)
        return fail(res, 400, "bad index")
      return await remuxAudio(url, index, res)
    }

    fail(res, 404, "not found")
  } catch (e) {
    fail(res, 500, String(e.message || e).slice(0, 200))
  }
})

server.listen(PORT, () =>
  console.log(`[vicine-subs] listening on :${PORT} (ffmpeg: ${FFMPEG})`)
)
