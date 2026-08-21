import { notFound } from "next/navigation";
import { fetchBySlug } from "@/lib/api";
import type { ContentType } from "@/lib/api";
import { WatchInnerClient } from "./watch-inner";

export default async function WatchPage({ params }: { params: Promise<{ type: string; slug: string }> }) {
  const { type: rawType, slug } = await params;
  const type = rawType as ContentType;
  if (!["movies", "anime", "series"].includes(type)) notFound();

  const result = await fetchBySlug(slug);
  if (!result) notFound();

  const activeType = (result.type as ContentType) ?? type;
  return <WatchInnerClient item={result.item} type={activeType} />;
}
