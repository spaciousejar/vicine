import { ListingShell } from "@/components/listing-page";
import { fetchMovies } from "@/lib/api";

export default async function MoviesPage({ searchParams }: { searchParams: Promise<{ page?: string; q?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const q = sp.q ?? "";
  const res = await fetchMovies(page, 24);
  return (
    <ListingShell
      title="Movies"
      description="10,134 titles — 480p / 720p / 1080p • Dual audio • WEB-DL"
      items={res.data}
      type="movies"
      page={res.pagination.page}
      pages={res.pagination.pages}
      total={res.pagination.total}
      q={q}
    />
  );
}
