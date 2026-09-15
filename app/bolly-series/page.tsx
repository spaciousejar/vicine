import { ListingShell } from "@/components/listing-page"
import { fetchBollySeries, searchContent } from "@/lib/api"

export const revalidate = 300

export default async function BollywoodSeriesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>
}) {
  const sp = await searchParams
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1)
  const q = sp.q ?? ""
  const res = await fetchBollySeries(page, 24)
  const items = q ? await searchContent(q) : res.data
  return (
    <ListingShell
      title="Bollywood Series"
      description={`${res.pagination.total.toLocaleString()} Bollywood shows, multi-season. Hindi & regional TV.`}
      items={items}
      type="bolly_series"
      page={q ? 1 : res.pagination.page}
      pages={q ? 1 : res.pagination.pages}
      q={q}
    />
  )
}
