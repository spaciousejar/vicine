import { MediaGrid } from "@/components/media-grid"
import { AppPagination } from "@/components/pagination"
import { CategoryFilter } from "@/components/category-filter"
import { SiteHeader } from "@/components/site-header"
import { RevealSection } from "@/components/reveal-section"
import type { ContentType } from "@/lib/api"

export function ListingShell({
  title,
  description,
  items,
  type,
  page,
  pages,
  total,
  q,
}: {
  title: string
  description: string
  items: import("@/lib/api").MediaItem[]
  type: ContentType
  page: number
  pages: number
  total: number
  q: string
}) {
  return (
    <div className="min-h-svh bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-safe py-4 pb-safe sm:py-6">
        <div className="mb-6 space-y-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {title}
            </h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <CategoryFilter />
          {q && (
            <p className="text-xs text-muted-foreground">
              Search results for{" "}
              <span className="font-medium text-foreground">
                &quot;{q}&quot;
              </span>{" "}
              — {items.length} {items.length === 1 ? "title" : "titles"}
            </p>
          )}
        </div>
        <RevealSection>
          <MediaGrid items={items} type={type} />
        </RevealSection>
        {!q && <AppPagination page={page} pages={pages} total={total} />}
      </main>
    </div>
  )
}
