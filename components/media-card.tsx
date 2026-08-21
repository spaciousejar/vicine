import Link from "next/link"
import Image from "next/image"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import type { ContentType, MediaItem } from "@/lib/api"
import { getCategories, getImage, getYear } from "@/lib/api"

export function MediaCard({
  item,
  type,
}: {
  item: MediaItem
  type: ContentType
}) {
  const img = getImage(item)
  const cats = getCategories(item)
  const year = getYear(item)
  const topCats = cats.slice(0, 2)

  return (
    <Link href={`/watch/${type}/${item.url_slug}`} className="group block">
      <Card className="overflow-hidden border-0 bg-card py-0 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
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
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 pt-8">
            <div className="flex flex-wrap gap-1">
              {year && (
                <Badge
                  variant="secondary"
                  className="h-5 px-1.5 text-[10px] leading-none"
                >
                  {year}
                </Badge>
              )}
              {topCats.map((c) => (
                <Badge
                  key={c}
                  variant="secondary"
                  className="h-5 bg-white/90 px-1.5 text-[10px] leading-none text-black"
                >
                  {c}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        <CardContent className="p-2.5">
          <h3 className="line-clamp-2 text-sm leading-tight font-medium group-hover:text-primary">
            {item.title}
          </h3>
          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
            {cats.slice(0, 3).join(" • ")}
          </p>
        </CardContent>
      </Card>
    </Link>
  )
}

export function MediaCardSkeleton() {
  return (
    <Card className="overflow-hidden border-0 py-0">
      <div className="aspect-[2/3] animate-pulse bg-muted" />
      <div className="space-y-2 p-2.5">
        <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
      </div>
    </Card>
  )
}
