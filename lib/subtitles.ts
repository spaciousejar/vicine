export type SubtitleTrack = {
  id: string
  label: string
  lang: string
  /** Object URL for user uploads; filled lazily for embedded streams. */
  src: string
  /** Embedded stream discovered via ffprobe; extracted on demand. */
  embedded?: boolean
  index?: number
}

// Minimal SRT -> WebVTT: normalize timestamps and prepend the header.
function toVtt(text: string): string {
  const body = text
    .replace(/^\uFEFF/, "")
    .replace(/\r/g, "")
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2")
  return `WEBVTT\n\n${body.trim()}\n`
}

const LANG_HINTS: Record<string, string> = {
  en: "en",
  eng: "en",
  english: "en",
  hi: "hi",
  hin: "hi",
  hindi: "hi",
  ta: "ta",
  tamil: "ta",
  te: "te",
  telugu: "te",
  ml: "ml",
  malayalam: "ml",
  kn: "kn",
  kannada: "kn",
  bn: "bn",
  bengali: "bn",
  es: "es",
  spanish: "es",
  ar: "ar",
  arabic: "ar",
  fr: "fr",
  french: "fr",
}

function guessLang(filename: string): string {
  const parts = filename.toLowerCase().split(/[.\-_ ]/)
  for (const p of parts) if (LANG_HINTS[p]) return LANG_HINTS[p]
  return "en"
}

export async function filesToSubtitleTracks(
  files: FileList | null
): Promise<SubtitleTrack[]> {
  if (!files) return []
  const out: SubtitleTrack[] = []
  for (const file of Array.from(files)) {
    try {
      let text = await file.text()
      if (/\.srt$/i.test(file.name)) text = toVtt(text)
      const url = URL.createObjectURL(new Blob([text], { type: "text/vtt" }))
      out.push({
        id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        label: file.name.replace(/\.(vtt|srt)$/i, ""),
        lang: guessLang(file.name),
        src: url,
      })
    } catch {
      // unreadable file — skip it
    }
  }
  return out
}

/**
 * Incremental WebVTT parser for streamed extractions: feed raw chunks,
 * receive parsed cues as they complete across chunk boundaries.
 */
export function createCueStreamParser(
  onCue: (cue: { start: number; end: number; text: string }) => void
): { push: (chunk: string) => void; end: () => void } {
  let buf = ""
  const toSeconds = (s: string): number | null => {
    const m = s.trim().match(/(?:(\d+):)?(\d{2}):(\d{2})\.(\d{3})/)
    if (!m) return null
    return (
      (Number(m[1] ?? 0) || 0) * 3600 +
      Number(m[2]) * 60 +
      Number(m[3]) +
      Number(m[4]) / 1000
    )
  }
  // Parse one already-delimited block; ignore the header, NOTE blocks, and
  // anything without a valid cue-timing line or with empty text.
  const processBlock = (block: string) => {
    const lines = block.split(/\r?\n/)
    const ti = lines.findIndex((l) => l.includes("-->"))
    if (ti === -1) return
    const [a, b] = lines[ti].split("-->")
    const start = toSeconds(a)
    const end = toSeconds(b)
    if (start === null || end === null) return
    const text = lines
      .slice(ti + 1)
      .join("\n")
      .replace(/<[^>]+>/g, "")
      .trim()
    if (text) onCue({ start, end, text })
  }
  return {
    push(chunk: string) {
      buf += chunk
      let idx: number
      while ((idx = buf.search(/\r?\n\r?\n/)) !== -1) {
        processBlock(buf.slice(0, idx))
        buf = buf.slice(idx).replace(/^\r?\n\r?\n/, "")
      }
    },
    // Flush the trailing block at end-of-stream. Interior cues are delimited
    // by a blank line, but the final cue ends in a single newline (or none),
    // so without this call the last cue of every stream would be lost.
    end() {
      if (buf.trim()) processBlock(buf)
      buf = ""
    },
  }
}
