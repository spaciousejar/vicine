import { MediaGrid } from "@/components/media-grid";
import { AppPagination } from "@/components/pagination";
import { CategoryFilter } from "@/components/category-filter";
import { SiteHeader } from "@/components/site-header";
import type { ContentType } from "@/lib/api";

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
  title: string;
  description: string;
  items: import("@/lib/api").MediaItem[];
  type: ContentType;
  page: number;
  pages: number;
  total: number;
  q: string;
}) {
  const filtered = q
    ? items.filter(
        (i) =>
          i.title.toLowerCase().includes(q.toLowerCase()) ||
          (i.categories ?? "").toLowerCase().includes(q.toLowerCase())
      )
    : items;

  return (
    <div className="min-h-svh bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-6 space-y-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <CategoryFilter />
          {q && (
            <p className="text-xs text-muted-foreground">
              Filtered by <span className="font-medium text-foreground">&quot;{q}&quot;</span> — showing {filtered.length} of {items.length} on this page
            </p>
          )}
        </div>
        <MediaGrid items={filtered} type={type} />
        <AppPagination page={page} pages={pages} total={total} />
      </main>
    </div>
  );
}
