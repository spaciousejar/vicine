import { ListingShell } from "@/components/listing-page";
import { fetchAnime } from "@/lib/api";

export default async function AnimePage({ searchParams }: { searchParams: Promise<{ page?: string; q?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const q = sp.q ?? "";
  const res = await fetchAnime(page, 24);
  return (
    <ListingShell
      title="Anime"
      description="390 series — multi-season • 480p / 720p / 1080p"
      items={res.data}
      type="anime"
      page={res.pagination.page}
      pages={res.pagination.pages}
      total={res.pagination.total}
      q={q}
    />
  );
}
