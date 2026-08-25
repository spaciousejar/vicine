import Link from "next/link"
import Image from "next/image"
import { Badge } from "@/components/ui/badge"
import type { MediaItem } from "@/lib/api"
import { getContentType, getDisplayCategories, getYear } from "@/lib/api"
import { cn } from "@/lib/utils"

// Ranked horizontal scroller — oversized stroked rank numerals overlapping
// tall poster cards, snap-scrolled. Deliberately unlike the grid sections.
export function TrendingRow({ items }: { items: MediaItem[] }) {
  if (items.length === 0) return null

  return (
    <div className="relative">
      <div className="mx-bleed flex snap-x snap-mandatory [scrollbar-width:none] gap-4 overflow-x-auto px-safe pb-2 sm:gap-5 [&::-webkit-scrollbar]:hidden">
        {items.map((item, i) => {
          const img = item.featured_image || item.poster || null
          const year = getYear(item)
          return (
            <Link
              key={item._id ?? item.url_slug}
              href={`/watch/${getContentType(item)}/${item.url_slug}`}
              aria-label={`Number ${i + 1} trending: ${item.title}`}
              className="group relative shrink-0 snap-start items-end pt-6 sm:pt-8"
            >
              {/* Rank numeral — smaller on mobile to avoid overflow */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-1 -left-1 z-10 text-[4rem] leading-none font-black select-none sm:-left-3 sm:text-[5.5rem] md:text-[7rem]"
                style={{
                  WebkitTextStroke: "2px hsl(var(--primary))",
                  color: "transparent",
                }}
              >
                {i + 1}
              </span>
              <div className="relative ml-8 w-28 overflow-hidden rounded-xl bg-muted shadow-md transition-transform duration-300 group-hover:-translate-y-1 sm:ml-10 sm:w-36 md:w-44">
                <div className="relative aspect-[2/3]">
                  {img ? (
                    <Image
                      src={img}
                      alt={item.title}
                      fill
                      sizes="(max-width: 768px) 144px, 176px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                      No image
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-80" />
                  <div className="absolute inset-x-0 bottom-0 p-2">
                    {year && (
                      <Badge
                        variant="secondary"
                        className={cn(
                          "h-5 bg-white/90 px-1.5 text-[10px] leading-none text-black"
                        )}
                      >
                        {year}
                      </Badge>
                    )}
                  </div>
                </div>
                <p className="line-clamp-2 bg-card px-2 py-2 text-xs leading-tight font-medium transition-colors group-hover:text-primary">
                  {item.title}
                </p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

export function TrendingRowSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="mx-bleed flex gap-4 overflow-hidden px-safe pt-6 sm:gap-5 sm:pt-8">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="shrink-0 pt-6 sm:pt-8">
          <div className="ml-8 w-28 sm:ml-10 sm:w-36 md:w-44">
            <div className="aspect-[2/3] animate-pulse rounded-xl bg-muted" />
            <div className="mt-2 h-3 w-3/4 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  )
}
