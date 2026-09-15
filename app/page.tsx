import Link from "next/link"
import { Suspense } from "react"
import { SiteHeader } from "@/components/site-header"
import { MediaGrid, MediaGridSkeleton } from "@/components/media-grid"
import { RevealSection } from "@/components/reveal-section"
import { HomeHero } from "@/components/home-hero"
import { Separator } from "@/components/ui/separator"
import { buttonVariants } from "@/components/ui/button"
import {
  fetchAnime,
  fetchBollyMovies,
  fetchBollySeries,
  fetchMovies,
  fetchRecent,
  fetchSeries,
  fetchTrending,
} from "@/lib/api"
import {
  Clapperboard,
  Clock,
  Film,
  Flame,
  ListVideo,
  Sparkles,
  Tv,
} from "lucide-react"
import { TrendingRow, TrendingRowSkeleton } from "@/components/trending-row"
import { cn } from "@/lib/utils"

export default async function HomePage() {
  const [
    moviesRes,
    animeRes,
    seriesRes,
    bollyMoviesRes,
    bollySeriesRes,
    trending,
    recent,
  ] = await Promise.all([
    fetchMovies(1, 12),
    fetchAnime(1, 12),
    fetchSeries(1, 12),
    fetchBollyMovies(1, 12),
    fetchBollySeries(1, 12),
    fetchTrending(12),
    fetchRecent(12),
  ])

  const hero = moviesRes.data[0] ?? animeRes.data[0] ?? seriesRes.data[0]

  return (
    <div className="min-h-svh bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-safe py-4 pb-safe sm:py-6">
        {/* Hero — animated entrance */}
        {hero && <HomeHero hero={hero} />}

        <div className="mt-8 grid gap-8">
          {trending.length > 0 && (
            <>
              <RevealSection className="min-w-0">
                <div className="mb-3 flex items-center gap-2">
                  <Flame className="size-4 text-primary" />
                  <h2 className="text-lg font-semibold tracking-tight">
                    Trending now
                  </h2>
                </div>
                <Suspense fallback={<TrendingRowSkeleton />}>
                  <TrendingRow items={trending} />
                </Suspense>
              </RevealSection>
              <Separator />
            </>
          )}
          {recent.length > 0 && (
            <>
              <RevealSection>
                <Section
                  title="New releases"
                  icon={<Clock className="size-4" />}
                  items={recent.slice(0, 6)}
                />
              </RevealSection>
              <Separator />
            </>
          )}
          <RevealSection>
            <Section
              title="Movies"
              icon={<Film className="size-4" />}
              href="/movies"
              items={moviesRes.data.slice(0, 6)}
              type="movies"
            />
          </RevealSection>
          <Separator />
          <RevealSection>
            <Section
              title="Bollywood Movies"
              icon={<Clapperboard className="size-4" />}
              href="/bolly-movies"
              items={bollyMoviesRes.data.slice(0, 6)}
              type="bolly_movies"
            />
          </RevealSection>
          <Separator />
          <RevealSection>
            <Section
              title="Anime"
              icon={<Sparkles className="size-4" />}
              href="/anime"
              items={animeRes.data.slice(0, 6)}
              type="anime"
            />
          </RevealSection>
          <Separator />
          <RevealSection>
            <Section
              title="Series"
              icon={<Tv className="size-4" />}
              href="/series"
              items={seriesRes.data.slice(0, 6)}
              type="series"
            />
          </RevealSection>
          <Separator />
          <RevealSection>
            <Section
              title="Bollywood Series"
              icon={<ListVideo className="size-4" />}
              href="/bolly-series"
              items={bollySeriesRes.data.slice(0, 6)}
              type="bolly_series"
            />
          </RevealSection>
        </div>
      </main>
    </div>
  )
}

function Section({
  title,
  icon,
  href,
  items,
  type,
}: {
  title: string
  icon: React.ReactNode
  href?: string
  items: import("@/lib/api").MediaItem[]
  type?: import("@/lib/api").ContentType
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex min-w-0 items-center gap-2 text-lg font-semibold tracking-tight">
          {icon}
          {title}
        </h2>
        {href && (
          <Link
            href={href}
            data-slot="button"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "shrink-0"
            )}
          >
            View all {title} →
          </Link>
        )}
      </div>
      <Suspense fallback={<MediaGridSkeleton count={6} />}>
        <MediaGrid items={items} type={type} />
      </Suspense>
    </section>
  )
}
