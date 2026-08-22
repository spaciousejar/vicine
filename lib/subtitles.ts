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
