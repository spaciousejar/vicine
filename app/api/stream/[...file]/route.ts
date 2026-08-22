import { NextRequest, NextResponse } from "next/server"
import { spawn, type ChildProcess } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, createReadStream } from "node:fs"
import { Readable } from "node:stream"
import fs from "node:fs/promises"
import path from "node:path"
import os from "node:os"

const STREAM_ROOT = path.join(os.tmpdir(), "vicine-streams")
const IDLE_KILL_MS = 10 * 60_000
const SEGMENT_WAIT_MS = 15_000
const PLAYLIST_WAIT_MS = 45_000

type StreamJob = {
  dir: string
  proc: ReturnType<typeof spawn> | null
  lastAccess: number
}

// Survives dev-server HMR reloads.
const g = globalThis as unknown as {
  __streamJobs?: Map<string, StreamJob>
  __streamSweeper?: NodeJS.Timeout
}
g.__streamJobs ??= new Map<string, StreamJob>()
const jobs = g.__streamJobs

function hashUrl(url: string): string {
  return createHash("sha1").update(url).digest("hex").slice(0, 16)
}

const MEDIA_HOST_RE = new RegExp(
  "(^|\\.)(" +
    ["vcloud.fit", "workers.dev", "googleusercontent.com", "r2.dev", "hicine.sbs"].join("|") +
    ")$",
  "i"
);

function isSafeSourceUrl(url: string): boolean {
  try {
    const u = new URL(url)
    if (u.protocol !== "https:" && u.protocol !== "http:") return false
    if (u.username || u.password) return false
    if (/^localhost$|\.local$|\.internal$/i.test(u.hostname)) return false
    if (/^[0-9.:]+$/.test(u.hostname)) return false
    if (!MEDIA_HOST_RE.test(u.hostname)) return false
    return true
  } catch {
    return false
  }
}

async function ensureJob(
  hash: string,
  sourceUrl: string
): Promise<StreamJob | null> {
  const existing = jobs.get(hash)
  if (existing) {
    existing.lastAccess = Date.now()
    if (existsSync(path.join(existing.dir, "index.m3u8"))) {
      return existing
    }
    // Output directory vanished or the process died before producing a
    // playlist — tear it down and start over.
    if (existing.proc && existing.proc.exitCode === null) {
      existing.proc.kill("SIGKILL")
    }
    jobs.delete(hash)
    await fs.rm(existing.dir, { recursive: true, force: true }).catch(() => {})
  }

  await fs.mkdir(STREAM_ROOT, { recursive: true })
  const dir = path.join(STREAM_ROOT, hash)
  await fs.rm(dir, { recursive: true, force: true })
  await fs.mkdir(dir, { recursive: true })

  // Transmux only: video is stream-copied; audio re-encoded to AAC because
  // Firefox/Safari cannot decode some MKV audio codecs inside MPEG-TS.
  const args = [
    "-nostdin",
    "-loglevel",
    "error",
    "-i",
    sourceUrl,
    "-map",
    "0:v:0",
    "-map",
    "0:a:0?",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-af",
    "aresample=async=1",
    "-f",
    "hls",
    "-hls_time",
    "4",
    "-hls_list_size",
    "0",
    "-hls_segment_filename",
    path.join(dir, "seg_%04d.ts"),
    path.join(dir, "index.m3u8"),
  ]

  let proc: ChildProcess
  try {
    proc = spawn("ffmpeg", args, { stdio: "ignore" })
  } catch {
    return null
  }

  const job: StreamJob = { dir, proc, lastAccess: Date.now() }
  jobs.set(hash, job)

  proc.on("exit", () => {
    const j = jobs.get(hash)
    if (j && j.proc === proc) j.proc = null
  })
  return job
}

async function waitForFile(
  file: string,
  timeoutMs: number,
  proc?: ChildProcess | null
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      await fs.access(file)
      return true
    } catch {}
    // Don't burn the whole budget if ffmpeg already died.
    if (proc && proc.exitCode !== null && !existsSync(file)) return false
    await new Promise((r) => setTimeout(r, 250))
  }
  return existsSync(file)
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ file: string[] }> }
) {
  const { file } = await ctx.params
  const [hash, name] = file ?? []
  if (!hash || !name) {
    return NextResponse.json({ error: "Bad stream path" }, { status: 400 })
  }

  // Segment paths must carry the real job hash; playlist paths may use any
  // label since the hash is derived from the ?url= parameter.
  const isPlaylist = name.endsWith(".m3u8")
  if (!isPlaylist && !/^[0-9a-f]{16}$/.test(hash)) {
    return NextResponse.json({ error: "Bad stream path" }, { status: 400 })
  }

  if (!g.__streamSweeper) {
    g.__streamSweeper = setInterval(() => {
      for (const [h, j] of jobs) {
        if (Date.now() - j.lastAccess > IDLE_KILL_MS) {
          j.proc?.kill("SIGKILL")
          jobs.delete(h)
          fs.rm(j.dir, { recursive: true, force: true }).catch(() => {})
        }
      }
    }, 60_000)
    g.__streamSweeper.unref?.()
  }

  if (name.endsWith(".m3u8")) {
    const sourceUrl = req.nextUrl.searchParams.get("url")
    if (!sourceUrl || !isSafeSourceUrl(sourceUrl)) {
      return NextResponse.json(
        { error: "Missing or unsafe url" },
        { status: 400 }
      )
    }

    let ffmpegOk = true
    try {
      await new Promise((resolve, reject) => {
        const check = spawn("ffmpeg", ["-version"], { stdio: "ignore" })
        check.on("exit", (c: number | null) =>
          c === 0 ? resolve(null) : reject(new Error())
        )
        check.on("error", reject)
      })
    } catch {
      ffmpegOk = false
    }
    if (!ffmpegOk) {
      return NextResponse.json(
        { error: "ffmpeg unavailable on server" },
        { status: 501 }
      )
    }

    const realHash = hashUrl(sourceUrl)
    const job = await ensureJob(realHash, sourceUrl)
    if (!job) {
      return NextResponse.json(
        { error: "Failed to start transcode" },
        { status: 500 }
      )
    }

    const playlistFile = path.join(job.dir, "index.m3u8")
    const ok = await waitForFile(playlistFile, PLAYLIST_WAIT_MS, job.proc)
    if (!ok) {
      return NextResponse.json(
        { error: "Transcode did not start" },
        { status: 504 }
      )
    }

    // Rewrite segment URIs to absolute paths carrying the job's real hash
    // so they resolve correctly no matter which path the playlist was
    // requested from. Declare VOD explicitly: until ffmpeg writes
    // EXT-X-ENDLIST, hls.js would otherwise treat this as a live stream
    // and start playback at the newest (near-end) segment.
    const body = (await fs.readFile(playlistFile, "utf8"))
      .replace("#EXTM3U", "#EXTM3U\n#EXT-X-PLAYLIST-TYPE:VOD")
      .replace(/\bseg_(\d+\.ts)\b/g, `/api/stream/${realHash}/seg_$1`)
    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Cache-Control": "no-store",
      },
    })
  }

  // Segment request: /api/stream/{hash}/seg_0001.ts
  if (!/^[\w.-]+\.ts$/.test(name)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const segPath = path.join(STREAM_ROOT, hash, path.basename(name))
  const job = jobs.get(hash)
  const ok = await waitForFile(segPath, SEGMENT_WAIT_MS, job?.proc)
  if (!ok) {
    return NextResponse.json({ error: "Segment not ready" }, { status: 404 })
  }

  const stat = await fs.stat(segPath)
  const webStream = Readable.toWeb(createReadStream(segPath)) as ReadableStream
  return new NextResponse(webStream, {
    headers: {
      "Content-Type": "video/mp2t",
      "Content-Length": String(stat.size),
      "Cache-Control": "no-store",
    },
  })
}
