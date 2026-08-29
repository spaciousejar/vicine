import Link from "next/link"
import Image from "next/image"
import { Play } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { getContentType, getImage } from "@/lib/api"
import type { MediaItem } from "@/lib/api"
import { cn } from "@/lib/utils"

export function HomeHero({ hero }: { hero: MediaItem }) {
  const heroImg = getImage(hero)
  const cats =
    hero.categories
      ?.split(",")
      .map((c) => c.trim())
      .filter(Boolean) ?? []

  return (
    <Card className="overflow-hidden border-0 bg-card py-0 shadow-sm ring-1 ring-foreground/5">
      <div className="grid md:grid-cols-[1.1fr_0.9fr] md:items-stretch">
        <div className="relative aspect-[16/9] overflow-hidden bg-muted sm:aspect-[16/10] md:aspect-auto md:min-h-[22rem]">
          {heroImg ? (
            <Image
              src={heroImg}
              alt={hero.title}
              fill
              priority
              loading="eager"
              sizes="(max-width: 768px) 100vw, (max-width: 1280px) 55vw, 700px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              No image
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent md:bg-gradient-to-r" />
        </div>

        <div className="flex flex-col justify-center gap-4 p-5 sm:gap-5 sm:p-7">
          {cats.length > 0 && (
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {cats.slice(0, 3).join(", ")}
            </p>
          )}

          <h1 className="font-[family-name:var(--font-display)] text-2xl leading-tight font-bold tracking-tight sm:text-3xl md:text-4xl lg:text-5xl">
            {hero.title}
          </h1>

          <p className="line-clamp-3 max-w-[55ch] text-sm text-muted-foreground">
            {hero.excerpt ?? "Watch in 480p, 720p, 1080p. Streaming on VICINE."}
          </p>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/watch/${getContentType(hero)}/${hero.url_slug}`}
              data-slot="button"
              className={cn(buttonVariants({ size: "lg" }), "gap-2")}
            >
              <Play className="size-4 fill-current" /> Watch now
            </Link>
            <Link
              href="/movies"
              data-slot="button"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
            >
              Browse movies
            </Link>
          </div>
        </div>
      </div>
    </Card>
  )
}
