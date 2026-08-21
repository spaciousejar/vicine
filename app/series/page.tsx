import { ListingShell } from "@/components/listing-page";
import { fetchSeries } from "@/lib/api";

export default async function SeriesPage({ searchParams }: { searchParams: Promise<{ page?: string; q?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const q = sp.q ?? "";
  const res = await fetchSeries(page, 24);
  return (
    <ListingShell
      title="Series"
      description="1,931 series — K-Drama • Hollywood • Multi-season"
      items={res.data}
      type="series"
      page={res.pagination.page}
      pages={res.pagination.pages}
      total={res.pagination.total}
      q={q}
    />
  );
}
