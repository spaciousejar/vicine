import { ListingShell } from "@/components/listing-page"
import { fetchSeries, searchContent } from "@/lib/api"

export default async function SeriesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>
}) {
  const sp = await searchParams
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1)
  const q = sp.q ?? ""
  const res = await fetchSeries(page, 24)
  const items = q ? await searchContent(q) : res.data
  return (
    <ListingShell
      title="Series"
      description="1,931 series. K-Drama, Hollywood, multi-season."
      items={items}
      type="series"
      page={q ? 1 : res.pagination.page}
      pages={q ? 1 : res.pagination.pages}
      q={q}
    />
  )
}
