import Link from "next/link";
import { Suspense } from "react";
import { SiteHeader } from "@/components/site-header";
import { MediaGrid, MediaGridSkeleton } from "@/components/media-grid";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { fetchAnime, fetchMovies, fetchSeries, getImage } from "@/lib/api";
import { Clapperboard, Film, Tv, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export default async function HomePage() {
  const [moviesRes, animeRes, seriesRes] = await Promise.all([
    fetchMovies(1, 12),
    fetchAnime(1, 12),
    fetchSeries(1, 12),
  ]);

  const hero = moviesRes.data[0] ?? animeRes.data[0] ?? seriesRes.data[0];
  const heroImg = hero ? getImage(hero) : null;

  return (
    <div className="min-h-svh bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 py-6">
        {/* Hero */}
        {hero && (
          <Card className="overflow-hidden border-0 bg-muted py-0">
            <div className="grid md:grid-cols-[1.1fr_0.9fr]">
              <div className="relative aspect-[16/10] overflow-hidden bg-muted md:aspect-[4/3]">
                {heroImg ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={heroImg} alt={hero.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">No image</div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent md:hidden" />
              </div>
              <div className="flex flex-col justify-center gap-4 p-6">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary" className="gap-1"><Sparkles className="size-3" /> Featured</Badge>
                  <span>•</span>
                  <span>{hero.categories?.split(",").slice(0, 2).join(" • ")}</span>
                </div>
                <h1 className="text-2xl font-semibold leading-tight tracking-tight md:text-3xl">{hero.title}</h1>
                <p className="line-clamp-3 text-sm text-muted-foreground">
                  {hero.excerpt ?? "Watch in 480p, 720p, 1080p — streaming via VICINE."}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/watch/movies/${hero.url_slug}`} className={cn(buttonVariants({ size: "lg" }), "gap-2")}>
                    <Clapperboard className="size-4" /> Watch now
                  </Link>
                  <Link href="/movies" className={cn(buttonVariants({ variant: "outline" }))}>Browse movies</Link>
                </div>
              </div>
            </div>
          </Card>
        )}

        <div className="mt-8 grid gap-8">
          <Section title="Movies" icon={<Film className="size-4" />} href="/movies" items={moviesRes.data.slice(0, 6)} type="movies" />
          <Separator />
          <Section title="Anime" icon={<Sparkles className="size-4" />} href="/anime" items={animeRes.data.slice(0, 6)} type="anime" />
          <Separator />
          <Section title="Series" icon={<Tv className="size-4" />} href="/series" items={seriesRes.data.slice(0, 6)} type="series" />
        </div>
      </main>
    </div>
  );
}

function Section({ title, icon, href, items, type }: { title: string; icon: React.ReactNode; href: string; items: import("@/lib/api").MediaItem[]; type: import("@/lib/api").ContentType }) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">{icon}{title}</h2>
        <Link href={href} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>View all →</Link>
      </div>
      <Suspense fallback={<MediaGridSkeleton count={6} />}>
        <MediaGrid items={items} type={type} />
      </Suspense>
    </section>
  );
}
