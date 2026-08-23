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
const PROBE_TIMEOUT_MS = 30_000
const EXTRACT_TIMEOUT_MS = 280_000 // whole-file read; must outlive the proxy route
const CACHE_DIR = path.join(os.tmpdir(), "vicine-subs")
fs.mkdirSync(CACHE_DIR, { recursive: true })

// Sweep abandoned partial extractions from previous runs/crashes.
for (const f of fs.readdirSync(CACHE_DIR)) {
  if (f.endsWith(".part")) {
    try { fs.unlinkSync(path.join(CACHE_DIR, f)) } catch {}
  }
}

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

const MEDIA_HOST_RE = new RegExp(
  "(^|\\.)(" +
    ["vcloud.fit", "workers.dev", "googleusercontent.com", "r2.dev", "hicine.sbs"].join("|") +
    ")$", "i");

function safeUrl(u) {
  try {
    const parsed = new URL(u)
    if (!/^https?:$/.test(parsed.protocol)) return null
    if (/^localhost$|\.local$|\.internal$/i.test(parsed.hostname)) return null
    if (/^[0-9.:]+$/.test(parsed.hostname)) return null // literal IPs
    if (!MEDIA_HOST_RE.test(parsed.hostname)) return null
    return parsed.toString()
  } catch {
    return null
  }
}

// Cache identity comes from the caller-supplied stable key when present —
// resolved media urls carry rotating signed params that would otherwise
// bust the cache every session.
function cachePath(key, url, index) {
  // Stable identity: explicit key wins; otherwise strip the rotating
  // signed-query so the same media file always maps to the same cache.
  let id = url
  if (key && key.length <= 300) {
    id = key
  } else {
    try {
      const u = new URL(url)
      id = u.origin + u.pathname
    } catch {}
  }
  const hash = crypto.createHash("sha1").update(`${id}|${index}`).digest("hex")
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
  const stdout = await execFileFile(FFPROBE, args, { timeout: PROBE_TIMEOUT_MS })
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
      // Video stream-copies; E-AC3/DTS cannot copy into MP4 ("Cannot
      // write moov atom before EAC3 packets parsed"), so the selected
      // track transcodes to AAC — cheap relative to video.
      "-c:v",
      "copy",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-ac",
      "2",
      "-movflags",
      "frag_keyframe+empty_moov",
      "-f",
      "mp4",
      "pipe:1",
    ],
    { stdio: ["ignore", "pipe", "pipe"] }
  )
  child.stderr.on("data", (d) =>
    process.stderr.write("[remux] " + String(d).slice(-300))
  )
  child.stdout.pipe(res)
  // Stop ffmpeg if the client disconnects.
  res.on("close", () => child.kill("SIGKILL"))
}

async function extract(url, index, res, key) {
  const cached = cachePath(key, url, index)
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
    await execFileFile(FFMPEG, args, { timeout: EXTRACT_TIMEOUT_MS })
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


// Full link-resolution from the residential network: upstream hosts block
// datacenter egress, so this box is the only place the whole chain works.
async function resolveChain(workerBase, vcloudUrl) {
  const linksRes = await fetch(
    `${workerBase}/api/links?vcloud=${encodeURIComponent(vcloudUrl)}`,
    { headers: { "user-agent": BROWSER_UA }, signal: AbortSignal.timeout(15000) }
  )
  if (!linksRes.ok) throw new Error(`links ${linksRes.status}`)
  const data = await linksRes.json()
  const tokens = Object.entries(data.tokens || {}).filter(
    ([, t]) => t && t.ts && t.sig
  )

  const follow = async ([type, t]) => {
    let u = `${workerBase}/go?type=${type}&vcloud=${encodeURIComponent(vcloudUrl)}&ts=${t.ts}&sig=${t.sig}`
    for (let hop = 0; hop < 6; hop++) {
      const r = await fetch(u, {
        redirect: "manual",
        method: "GET",
        headers: { "user-agent": BROWSER_UA },
        signal: AbortSignal.timeout(20000),
      })
      try { await r.body?.cancel() } catch {}
      if (r.status >= 300 && r.status < 400) {
        const next = r.headers.get("location")
        if (!next) throw new Error("no location")
        u = new URL(next, u).toString()
        // dl.php wraps the real link in its query param
        const parsed = new URL(u)
        if (parsed.pathname.endsWith("dl.php")) {
          const link = parsed.searchParams.get("link")
          if (link) return link
        }
        continue
      }
      return u
    }
    throw new Error("too many hops")
  }

  const attempts = tokens.map(async ([type, t]) => {
    const finalUrl = await follow([type, t])
    // Verify playability (HEAD then ranged GET fallback).
    let ok = false
    try {
      const h = await fetch(finalUrl, {
        method: "HEAD",
        headers: { "user-agent": BROWSER_UA },
        signal: AbortSignal.timeout(15000),
      })
      ok =
        (h.status === 200 || h.status === 206) &&
        !/^text\/html/i.test(h.headers.get("content-type") ?? "")
    } catch {}
    if (!ok) {
      const g = await fetch(finalUrl, {
        method: "GET",
        headers: { "user-agent": BROWSER_UA, range: "bytes=0-1023" },
        signal: AbortSignal.timeout(15000),
      })
      try { await g.body?.cancel() } catch {}
      ok =
        (g.status === 200 || g.status === 206) &&
        !/^text\/html/i.test(g.headers.get("content-type") ?? "")
    }
    if (!ok) throw new Error(`unplayable ${type}`)
    return { type, url: finalUrl }
  })

  const results = await Promise.allSettled(attempts)
  const winner = results.find((r) => r.status === "fulfilled")
  if (!winner) throw new Error("all mirrors failed")
  return {
    videoUrl: winner.value.url,
    title: data.title,
    size: data.size,
  }
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

    if (pathname === "/resolve") {
      const target = safeUrl(u.searchParams.get("url") || "")
      if (!target) return fail(res, 400, "missing or invalid url")
      try {
        const out = await resolveChain(
          "https://quiet-lab-41f9.yolku.workers.dev",
          target
        )
        cors(res)
        return res.end(JSON.stringify(out))
      } catch (e) {
        fail(res, 502, String(e.message || e).slice(0, 160))
        return
      }
    }

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
      const key = u.searchParams.get("key") || ""
      return await extract(url, index, res, key.slice(0, 300))
    }


    if (pathname === "/extract-stream") {
      const index = Number.parseInt(u.searchParams.get("index") || "", 10)
      if (!Number.isInteger(index) || index < 0)
        return fail(res, 400, "bad index")
      const key = (u.searchParams.get("key") || "").slice(0, 300)

      // Serve a completed cached extraction instantly when available.
      const cachedPath = cachePath(key, url, index)
      if (fs.existsSync(cachedPath)) {
        cors(res, "text/vtt")
        return fs.createReadStream(cachedPath).pipe(res)
      }

      res.writeHead(200, {
        "access-control-allow-origin": "*",
        "content-type": "text/vtt",
        "cache-control": "no-store",
      })
      // ffmpeg's webvtt output is block-buffered on pipes (cues would sit
      // in stdio until exit), so write to a file and tail it to the client
      // as it grows. On clean completion the .part promotes to cache.
      const tmp = `${cachePath(key, url, index)}.${process.pid}.part`
      const child = spawn(
        FFMPEG,
        [
          "-nostdin",
          "-user_agent", BROWSER_UA,
          "-i", url,
          "-map", `0:${index}`,
          "-flush_packets", "1",
          "-f", "webvtt",
          "-y", tmp,
        ],
        { stdio: ["ignore", "ignore", "pipe"] }
      )
      child.stderr.on("data", (d) =>
        process.stderr.write("[extract-stream] " + String(d).slice(-300))
      )

      let sent = 0
      let finished = false
      const finish = (code) => {
        if (finished) return
        finished = true
        clearInterval(poll)
        try { res.end(); } catch {}
        if (code === 0 && sent > 0) {
          try { fs.renameSync(tmp, cachePath(key, url, index)); } catch {}
        } else {
          try { fs.unlinkSync(tmp); } catch {}
        }
        console.log(`[extract-stream] exited code=${code} sent=${sent}B`)
      }

      // Tail as the file grows: each tick reads whatever appeared past the
      // last sent offset.
      const poll = setInterval(() => {
        try {
          if (!fs.existsSync(tmp)) return
          const size = fs.statSync(tmp).size
          if (size <= sent) return
          const fd = fs.openSync(tmp, "r")
          const buf = Buffer.alloc(size - sent)
          fs.readSync(fd, buf, 0, buf.length, sent)
          fs.closeSync(fd)
          res.write(buf)
          sent += buf.length
        } catch {}
      }, 200)

      child.on("close", (code) => {
        // give the tail a beat to drain the last flush
        setTimeout(() => finish(code ?? 1), 300)
      })
      res.on("close", () => {
        finished = true
        clearInterval(poll)
        child.kill("SIGKILL")
        try { fs.unlinkSync(tmp); } catch {}
      })
      return
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
