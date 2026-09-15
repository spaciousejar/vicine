import { ListingShell } from "@/components/listing-page"
import { fetchBollyMovies, searchContent } from "@/lib/api"

export const revalidate = 300

export default async function BollywoodMoviesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>
}) {
  const sp = await searchParams
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1)
  const q = sp.q ?? ""
  const res = await fetchBollyMovies(page, 24)
  const items = q ? await searchContent(q) : res.data
  return (
    <ListingShell
      title="Bollywood Movies"
      description={`${res.pagination.total.toLocaleString()} Bollywood titles in 480p / 720p / 1080p. Hindi, Tamil, Telugu & dubbed.`}
      items={items}
      type="bolly_movies"
      page={q ? 1 : res.pagination.page}
      pages={q ? 1 : res.pagination.pages}
      q={q}
    />
  )
}
