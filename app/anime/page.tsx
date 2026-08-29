import { ListingShell } from "@/components/listing-page"
import { fetchAnime, searchContent } from "@/lib/api"

export default async function AnimePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>
}) {
  const sp = await searchParams
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1)
  const q = sp.q ?? ""
  const res = await fetchAnime(page, 24)
  const items = q ? await searchContent(q) : res.data
  return (
    <ListingShell
      title="Anime"
      description="390 series, multi-season. Available in 480p / 720p / 1080p."
      items={items}
      type="anime"
      page={q ? 1 : res.pagination.page}
      pages={q ? 1 : res.pagination.pages}
      q={q}
    />
  )
}
