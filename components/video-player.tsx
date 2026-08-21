"use client"

import { useState, useEffect } from "react"
import Player from "next-video/player"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ExternalLink, Play, Copy, Check, Loader2 } from "lucide-react"

export function VideoPlayer({
  url,
  label,
}: {
  url: string | null
  label?: string
}) {
  const [copied, setCopied] = useState(false)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [resolving, setResolving] = useState(Boolean(url))
  const [error, setError] = useState(false)
  const [resolveAttempt, setResolveAttempt] = useState(0)

  const [prevUrl, setPrevUrl] = useState(url)
  if (url !== prevUrl) {
    setPrevUrl(url)
    setVideoUrl(null)
    setError(false)
    setResolving(Boolean(url))
    setResolveAttempt(0)
  }

  useEffect(() => {
    if (!url) return
    let cancelled = false

    fetch(`/api/resolve?url=${encodeURIComponent(url)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        if (data.videoUrl) {
          setVideoUrl(data.videoUrl)
        } else {
          setError(true)
        }
        setResolving(false)
      })
      .catch(() => {
        if (!cancelled) {
          setError(true)
          setResolving(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [url, resolveAttempt])

  // Resolved links can be short-lived or single-use; retry with a fresh
  // resolution before giving up.
  function handlePlayerError() {
    if (resolveAttempt >= 2) {
      setError(true)
      return
    }
    setVideoUrl(null)
    setResolving(true)
    setResolveAttempt((a) => a + 1)
  }

  if (!url) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-xl border bg-muted text-sm text-muted-foreground">
        Select a quality to start playback
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border bg-black">
        <div className="relative aspect-video w-full">
          {resolving && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black text-white">
              <Loader2 className="size-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Resolving video link…
              </p>
            </div>
          )}
          {videoUrl && (
            <Player
              key={videoUrl}
              src={videoUrl}
              autoPlay
              controls
              crossOrigin={undefined}
              onError={handlePlayerError}
              className="h-full w-full"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                backgroundColor: "black",
              }}
            />
          )}
          {error && (
            <iframe
              src={url}
              title={label ?? "Player"}
              allow="autoplay; fullscreen; encrypted-media"
              allowFullScreen
              className="absolute inset-0 h-full w-full border-0"
            />
          )}
          {!resolving && !videoUrl && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {label && (
          <Badge variant="secondary" className="gap-1">
            <Play className="size-3" />
            {label}
          </Badge>
        )}
        {videoUrl && (
          <Badge variant="default" className="gap-1 bg-green-600">
            Streaming
          </Badge>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            navigator.clipboard.writeText(url)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
          className="gap-1"
        >
          {copied ? (
            <Check className="size-3.5" />
          ) : (
            <Copy className="size-3.5" />
          )}
          {copied ? "Copied" : "Copy link"}
        </Button>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-7 items-center gap-1 rounded-2xl border bg-background px-3 text-sm font-medium hover:bg-muted"
        >
          <ExternalLink className="size-3.5" /> Open externally
        </a>
      </div>
      <p className="text-xs break-all text-muted-foreground">{url}</p>
    </div>
  )
}
