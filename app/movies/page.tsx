import { ListingShell } from "@/components/listing-page"
import { fetchMovies, searchContent } from "@/lib/api"

export default async function MoviesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>
}) {
  const sp = await searchParams
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1)
  const q = sp.q ?? ""
  const res = await fetchMovies(page, 24)
  const items = q ? await searchContent(q) : res.data
  return (
    <ListingShell
      title="Movies"
      description="10,134 titles in 480p / 720p / 1080p. Dual audio, WEB-DL."
      items={items}
      type="movies"
      page={q ? 1 : res.pagination.page}
      pages={q ? 1 : res.pagination.pages}
      q={q}
    />
  )
}
