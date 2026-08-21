"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { SiteHeader } from "@/components/site-header"
import { VideoPlayer } from "@/components/video-player"
import { SeasonEpisodes } from "@/components/season-episodes"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import {
  getCategories,
  getImage,
  getSeasons,
  getYear,
  parseMovieLinks,
} from "@/lib/api"
import type { ContentType, MediaItem } from "@/lib/api"

export function WatchInnerClient({
  item,
  type,
}: {
  item: MediaItem
  type: ContentType
}) {
  const img = getImage(item)
  const cats = getCategories(item)
  const year = getYear(item)
  const seasons = getSeasons(item)
  const movieLinks = type === "movies" ? parseMovieLinks(item.links) : []

  const [url, setUrl] = useState<string | null>(
    movieLinks[0]?.url ?? seasons[0]?.episodes[0]?.links[0]?.url ?? null
  )
  const [label, setLabel] = useState<string | undefined>(
    movieLinks[0]
      ? `${movieLinks[0].label}${movieLinks[0].size ? ` • ${movieLinks[0].size}` : ""}`
      : seasons[0]
        ? `S${seasons[0].season} E${seasons[0].episodes[0]?.episode} — ${seasons[0].episodes[0]?.links[0]?.quality}`
        : undefined
  )
  // Sources that failed to resolve — surfaced as unavailable so users stop
  // clicking known-dead links.
  const [failedUrls, setFailedUrls] = useState<string[]>([])

  function markUnresolved(u: string) {
    setFailedUrls((prev) => (prev.includes(u) ? prev : [...prev, u]))
  }

  function play(u: string, l: string) {
    setUrl(u)
    setLabel(l)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  return (
    <div className="min-h-svh bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
          <Link
            href={`/${type}`}
            className="text-muted-foreground hover:text-foreground"
          >
            ← Back to {type}
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="font-medium">{item.title}</span>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.6fr_0.9fr]">
          <div className="space-y-4">
            <VideoPlayer
              url={url}
              label={label}
              onUnresolved={markUnresolved}
            />

            <div className="flex flex-wrap gap-1.5">
              {year && <Badge variant="secondary">{year}</Badge>}
              {cats.slice(0, 6).map((c) => (
                <Badge key={c} variant="outline">
                  {c}
                </Badge>
              ))}
            </div>

            {type === "movies" ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    Available qualities
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {movieLinks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No links available.
                    </p>
                  ) : (
                    movieLinks.map((l, i) => {
                      const failed = failedUrls.includes(l.url)
                      return (
                        <div
                          key={i}
                          className="flex items-center justify-between gap-3 rounded-lg border p-3"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {l.label}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {failed ? (
                                <span className="text-destructive">
                                  Unavailable
                                </span>
                              ) : (
                                l.size
                              )}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant={failed ? "secondary" : "default"}
                              disabled={failed}
                              onClick={() =>
                                play(
                                  l.url,
                                  `${l.label}${l.size ? ` • ${l.size}` : ""}`
                                )
                              }
                            >
                              {failed ? "Dead" : "Play"}
                            </Button>
                            <a
                              href={l.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex h-8 items-center rounded-2xl border bg-background px-3 text-sm hover:bg-muted"
                            >
                              Open
                            </a>
                          </div>
                        </div>
                      )
                    })
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Episodes</CardTitle>
                </CardHeader>
                <CardContent>
                  <SeasonEpisodes
                    seasons={seasons}
                    onPlay={play}
                    failedUrls={failedUrls}
                  />
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-4">
            <Card className="overflow-hidden py-0">
              <div className="relative aspect-[2/3] overflow-hidden bg-muted">
                {img ? (
                  <Image
                    src={img}
                    alt={item.title}
                    fill
                    sizes="(max-width: 1024px) 100vw, 33vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    No image
                  </div>
                )}
              </div>
              <CardContent className="space-y-3 p-4">
                <h1 className="text-lg leading-tight font-semibold">
                  {item.title}
                </h1>
                {item.excerpt && (
                  <p className="text-sm text-muted-foreground">
                    {item.excerpt}
                  </p>
                )}
                <Separator />
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p>
                    <span className="font-medium text-foreground">Slug:</span>{" "}
                    {item.url_slug}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">
                      Updated:
                    </span>{" "}
                    {new Date(item.modified_date).toLocaleDateString()}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Status:</span>{" "}
                    {item.status}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
