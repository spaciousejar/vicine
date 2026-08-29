"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { ParsedSeason } from "@/lib/api"
import { Play } from "lucide-react"

export function SeasonEpisodes({
  seasons,
  onPlay,
  failedUrls = [],
}: {
  seasons: ParsedSeason[]
  onPlay: (
    url: string,
    label: string,
    episodeLinks?: { label: string; url: string }[]
  ) => void
  // URLs that already failed to resolve — their quality buttons render dead.
  failedUrls?: string[]
}) {
  const [active, setActive] = useState(String(seasons[0]?.season ?? 1))
  if (seasons.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No episodes available.</p>
    )
  }

  return (
    <Tabs value={active} onValueChange={setActive}>
      <TabsList className="flex w-full [scrollbar-width:none] justify-start overflow-x-auto [&::-webkit-scrollbar]:hidden">
        {seasons.map((s) => (
          <TabsTrigger
            key={s.season}
            value={String(s.season)}
            className="shrink-0 px-3"
          >
            Season {s.season}
          </TabsTrigger>
        ))}
      </TabsList>
      {seasons.map((s) => (
        <TabsContent
          key={s.season}
          value={String(s.season)}
          className="space-y-2 pt-3"
        >
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {s.title}
          </p>
          <div className="grid gap-2">
            {s.episodes.map((ep, epIdx) => (
              <div
                key={`${ep.episode}-${epIdx}`}
                className="flex flex-col gap-2 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="text-sm font-medium">
                  Episode {ep.episode}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {ep.links.map((l, idx) => {
                    const failed = failedUrls.includes(l.url)
                    const isBest =
                      !failed &&
                      l.quality ===
                        [...ep.links]
                          .filter((x) => !failedUrls.includes(x.url))
                          .sort(
                            (a, b) =>
                              (parseInt(b.quality) || 0) -
                              (parseInt(a.quality) || 0)
                          )[0]?.quality
                    return (
                      <Button
                        key={idx}
                        size="sm"
                        variant={
                          failed ? "secondary" : isBest ? "default" : "outline"
                        }
                        disabled={failed}
                        onClick={() =>
                          onPlay(
                            l.url,
                            `S${s.season} E${ep.episode}, ${l.quality}`,
                            ep.links
                              .slice()
                              .sort((a, b) => {
                                const pa = parseInt(a.quality, 10) || 0
                                const pb = parseInt(b.quality, 10) || 0
                                return pb - pa
                              })
                              .map((x) => ({
                                label: x.quality,
                                url: x.url,
                              }))
                          )
                        }
                        className="gap-1 text-xs"
                      >
                        <Play className="size-3" aria-hidden="true" />
                        {l.quality}
                        {failed && (
                          <span className="sr-only">(unavailable)</span>
                        )}
                      </Button>
                    )
                  })}
                  {ep.links.length === 0 && (
                    <Badge variant="outline" className="text-xs">
                      No links
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      ))}
    </Tabs>
  )
}
