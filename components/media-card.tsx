import Link from "next/link"
import Image from "next/image"
import { Play } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import type { ContentType, MediaItem } from "@/lib/api"
import { getDisplayCategories, getImage, getYear } from "@/lib/api"

export function MediaCard({
  item,
  type,
}: {
  item: MediaItem
  type: ContentType
}) {
  const img = getImage(item)
  const cats = getDisplayCategories(item)
  const year = getYear(item)
  const topCats = cats.slice(0, 2)

  return (
    <Link href={`/watch/${type}/${item.url_slug}`} className="group block">
      <Card className="overflow-hidden border-0 bg-card py-0 shadow-sm ring-1 ring-foreground/5 transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-lg group-hover:ring-primary/20">
        <div className="relative aspect-[2/3] overflow-hidden bg-muted">
          {img ? (
            <Image
              src={img}
              alt={item.title}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
              className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted text-xs text-muted-foreground">
              No image
            </div>
          )}

          {/* Hover scrim + play affordance */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="flex size-12 translate-y-1 items-center justify-center rounded-full bg-white/95 text-black opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
              <Play className="ml-0.5 size-5 fill-current" aria-hidden="true" />
            </span>
          </div>

          {/* Bottom badges over scrim */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 pt-10">
            <div className="flex flex-wrap gap-1">
              {year && (
                <Badge
                  variant="secondary"
                  className="h-5 border-white/20 bg-black/60 px-1.5 text-[10px] leading-none text-white"
                >
                  {year}
                </Badge>
              )}
              {topCats.map((c, i) => (
                <Badge
                  key={`${c}-${i}`}
                  variant="secondary"
                  className="h-5 border-white/20 bg-black/60 px-1.5 text-[10px] leading-none text-white"
                >
                  {c}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        <CardContent className="p-2.5">
          <h3 className="line-clamp-2 font-[family-name:var(--font-display)] text-sm leading-tight font-semibold transition-colors group-hover:text-primary">
            {item.title}
          </h3>
          {cats.length > 0 && (
            <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
              {cats.slice(0, 3).join(" · ")}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}

export function MediaCardSkeleton() {
  return (
    <Card className="overflow-hidden border-0 ring-1 ring-foreground/5">
      <div className="aspect-[2/3] animate-pulse bg-muted" />
      <div className="space-y-2 p-2.5">
        <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
      </div>
    </Card>
  )
}
