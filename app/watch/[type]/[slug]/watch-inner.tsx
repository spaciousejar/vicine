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
import { Button, buttonVariants } from "@/components/ui/button"
import {
  getDisplayCategories,
  getImage,
  getSeasons,
  getYear,
  parseMovieLinks,
} from "@/lib/api"
import type { ContentType, MediaItem } from "@/lib/api"
import { MediaGrid } from "@/components/media-grid"
import { RevealSection } from "@/components/reveal-section"
import { cn } from "@/lib/utils"

export function WatchInnerClient({
  item,
  type,
  related = [],
}: {
  item: MediaItem
  type: ContentType
  related?: MediaItem[]
}) {
  const img = getImage(item)
  const cats = getDisplayCategories(item)
  const year = getYear(item)
  const seasons = getSeasons(item)
  const movieLinks = type === "movies" ? parseMovieLinks(item.links) : []

  // Rank sources by resolution first (1080p > 720p > 480p), then prefer the
  // smallest file at that resolution (faster start, same fidelity).
  const qualityScore = (raw: string): number => {
    const p = /(\d{3,4})p/i.exec(raw)
    const size = /([\d.]+)\s*(GB|MB)/i.exec(raw)
    const mb = size
      ? parseFloat(size[1]) * (size[2].toUpperCase() === "GB" ? 1024 : 1)
      : 0
    return (p ? parseInt(p[1], 10) : 0) * 100_000 - Math.round(mb)
  }

  const bestMovie = [...movieLinks].sort(
    (a, b) =>
      qualityScore(`${b.label}${b.size ?? ""}`) -
      qualityScore(`${a.label}${a.size ?? ""}`)
  )[0]
  const firstSeason = seasons[0]
  const firstEpisode = firstSeason?.episodes[0]
  const bestEpisodeLink = [...(firstEpisode?.links ?? [])].sort((a, b) => {
    // quality strings are bare ("480p"), rank via synthetic label
    return qualityScore(`x${b.quality}`) - qualityScore(`x${a.quality}`)
  })[0]

  const [url, setUrl] = useState<string | null>(
    bestMovie?.url ?? bestEpisodeLink?.url ?? null
  )
  const [label, setLabel] = useState<string | undefined>(
    bestMovie
      ? `${bestMovie.label}${bestMovie.size ? ` • ${bestMovie.size}` : ""}`
      : firstSeason && bestEpisodeLink
        ? `S${firstSeason.season} E${firstEpisode?.episode} — ${bestEpisodeLink.quality}`
        : undefined
  )
  // Sources that failed to resolve — surfaced as unavailable so users stop
  // clicking known-dead links.
  const [failedUrls, setFailedUrls] = useState<string[]>([])
  // For series/anime, the quality menu is scoped to the episode being
  // played; movies use the full link list.
  const initialEpisodeVariants = (firstEpisode?.links ?? [])
    .slice()
    .sort(
      (a, b) => qualityScore(`x${b.quality}`) - qualityScore(`x${a.quality}`)
    )
    .map((l) => ({ url: l.url, label: l.quality }))
  const [episodeVariants, setEpisodeVariants] = useState(initialEpisodeVariants)

  // Every playable source for this title — used by the in-player quality
  // menu for movies, and as the lookup for labels when episodes switch.
  const allVariants = (
    type === "movies"
      ? movieLinks.map((l) => ({
          url: l.url,
          label: `${l.label}${l.size ? ` [${l.size}]` : ""}`,
          text: `${l.label}${l.size ? ` • ${l.size}` : ""}`,
        }))
      : seasons.flatMap((s) =>
          s.episodes.flatMap((ep) =>
            ep.links.map((l) => ({
              url: l.url,
              label: `S${s.season}E${ep.episode} ${l.quality}`,
              text: `S${s.season} E${ep.episode} — ${l.quality}`,
            }))
          )
        )
  )
    .filter((v) => !failedUrls.includes(v.url))
    .sort((a, b) => qualityScore(b.label) - qualityScore(a.label))

  function markUnresolved(u: string) {
    setFailedUrls((prev) => (prev.includes(u) ? prev : [...prev, u]))
  }

  function play(
    u: string,
    l: string,
    links?: { label: string; url: string }[]
  ) {
    setUrl(u)
    setLabel(l)
    if (links) setEpisodeVariants(links)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  return (
    <div className="min-h-svh bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-safe py-4 pb-safe sm:py-6">
        <div className="mb-3 flex flex-wrap items-center gap-x-2 text-xs sm:mb-4">
          <Link
            href={`/${type}`}
            className="-ml-1 inline-flex min-h-9 items-center rounded-md px-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Back to {type}
          </Link>
          <span className="min-w-0 font-medium">{item.title}</span>
        </div>

        {/* Three placed blocks rather than two columns: on mobile the flow is
            player → title/meta → episodes, so you can see what you're watching
            without scrolling past the whole episode list. On lg the info card
            moves into the right column and spans both rows. */}
        <div className="grid gap-6 lg:grid-cols-[1.6fr_0.9fr] lg:items-start">
          <div className="space-y-4 lg:col-start-1 lg:row-start-1">
            <VideoPlayer
              url={url}
              label={label}
              variants={
                type === "movies" ? allVariants : (episodeVariants ?? [])
              }
              onUrlChange={(u) => {
                setUrl(u)
                const variant = allVariants.find((v) => v.url === u)
                if (variant?.text) setLabel(variant.text)
              }}
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
          </div>

          <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <Card className="overflow-hidden py-0">
              {/* A 2:3 poster at full width is a ~500px-tall wall on a phone,
                  so crop to a banner until the card is in its own column. */}
              <div className="relative aspect-[16/9] overflow-hidden bg-muted sm:aspect-[16/10] lg:aspect-[2/3]">
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

          <div className="lg:col-start-1 lg:row-start-2">
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
                      const qualityMatch = /(\d{3,4}p)/i.exec(l.label)
                      const quality = qualityMatch ? qualityMatch[1] : null
                      return (
                        <div
                          key={i}
                          className={cn(
                            "rounded-lg border p-3 transition-colors",
                            failed ? "opacity-50" : "bg-card hover:bg-accent/50"
                          )}
                        >
                          {/* Top row: badge + info */}
                          <div className="flex items-center gap-3">
                            {quality ? (
                              <span className="inline-flex h-8 shrink-0 items-center justify-center rounded-md bg-primary/10 px-2 text-xs font-bold text-primary tabular-nums sm:h-9 sm:min-w-[3.5rem] sm:text-sm">
                                {quality}
                              </span>
                            ) : (
                              <span className="inline-flex h-8 shrink-0 items-center justify-center rounded-md bg-muted px-2 text-xs font-medium text-muted-foreground sm:h-9 sm:min-w-[3.5rem] sm:text-sm">
                                HD
                              </span>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">
                                {l.label}
                              </p>
                              {l.size && (
                                <p className="text-xs text-muted-foreground">
                                  {l.size}
                                </p>
                              )}
                              {failed && (
                                <p className="text-xs text-destructive">
                                  Unavailable
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Buttons: full-width stack on mobile, inline on sm+ */}
                          <div className="mt-2 flex gap-2 sm:mt-0 sm:justify-end">
                            <Button
                              variant={failed ? "secondary" : "default"}
                              size="sm"
                              disabled={failed}
                              className="flex-1 sm:flex-none"
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
                              data-slot="button"
                              className={buttonVariants({
                                variant: "outline",
                                size: "sm",
                              })}
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
        </div>

        {/* Related content */}
        {related.length > 0 && (
          <RevealSection className="mt-12">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold tracking-tight">
                You might also like
              </h2>
              <Link
                href={`/${type}`}
                data-slot="button"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                View all →
              </Link>
            </div>
            <MediaGrid items={related} type={type} />
          </RevealSection>
        )}
      </main>
    </div>
  )
}
