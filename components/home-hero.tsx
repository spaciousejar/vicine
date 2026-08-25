import Link from "next/link"
import Image from "next/image"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Clapperboard, Sparkles } from "lucide-react"
import { getContentType, getImage } from "@/lib/api"
import type { MediaItem } from "@/lib/api"
import { cn } from "@/lib/utils"

export function HomeHero({ hero }: { hero: MediaItem }) {
  const heroImg = getImage(hero)

  return (
    <div className="animate-in duration-700 fill-mode-both fade-in slide-in-from-bottom-4">
      <Card className="overflow-hidden border-0 bg-muted py-0">
        <div className="grid md:grid-cols-[1.1fr_0.9fr]">
          <div className="relative aspect-[16/9] overflow-hidden bg-muted sm:aspect-[16/10] md:aspect-[4/3]">
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
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent md:hidden" />
          </div>
          <div className="flex flex-col justify-center gap-3 p-4 sm:gap-4 sm:p-6">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary" className="gap-1">
                <Sparkles className="size-3" /> Featured
              </Badge>
              <span>•</span>
              <span>{hero.categories?.split(",").slice(0, 2).join(" • ")}</span>
            </div>
            <h1 className="font-[family-name:var(--font-display)] text-2xl leading-tight font-bold tracking-tight sm:text-3xl md:text-4xl lg:text-5xl">
              {hero.title}
            </h1>
            <p className="line-clamp-3 text-sm text-muted-foreground">
              {hero.excerpt ??
                "Watch in 480p, 720p, 1080p — streaming via VICINE."}
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/watch/${getContentType(hero)}/${hero.url_slug}`}
                data-slot="button"
                className={cn(buttonVariants({ size: "lg" }), "gap-2")}
              >
                <Clapperboard className="size-4" /> Watch now
              </Link>
              <Link
                href="/movies"
                data-slot="button"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" })
                )}
              >
                Browse movies
              </Link>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
