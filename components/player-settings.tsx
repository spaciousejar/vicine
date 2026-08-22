"use client"

import { useRef } from "react"
import { Settings, Captions, Upload } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export type SubtitleTrack = {
  id: string
  label: string
  lang: string
  src: string
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

export function PlayerSettings({
  tracks,
  active,
  onActiveChange,
  onAddFiles,
}: {
  tracks: SubtitleTrack[]
  active: number
  onActiveChange: (index: number) => void
  onAddFiles: (files: FileList | null) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".vtt,.srt,text/vtt,application/x-subrip"
        multiple
        hidden
        onChange={(e) => {
          onAddFiles(e.target.files)
          e.target.value = ""
        }}
      />
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Player settings"
          className="absolute top-2 right-2 z-30 inline-flex size-9 items-center justify-center rounded-lg bg-black/60 text-white backdrop-blur transition-colors hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <Settings className="size-4" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="flex items-center gap-2">
              <Captions className="size-4" aria-hidden="true" /> Subtitles
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuRadioGroup
            value={String(active)}
            onValueChange={(value) => onActiveChange(Number(value))}
          >
            <DropdownMenuRadioItem value="-1">Off</DropdownMenuRadioItem>
            {tracks.map((t, i) => (
              <DropdownMenuRadioItem key={t.id} value={String(i)}>
                <span className="truncate">{t.label}</span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => inputRef.current?.click()}>
            <Upload className="size-4" aria-hidden="true" />
            Load subtitle file…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
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
        id: `${file.name}-${Date.now()}`,
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
