import { notFound } from "next/navigation"
import { fetchBySlug, fetchRelated, toContentType } from "@/lib/api"
import { WatchInnerClient } from "./watch-inner"

export const revalidate = 300

export default async function WatchPage({
  params,
}: {
  params: Promise<{ type: string; slug: string }>
}) {
  const { type: rawType, slug } = await params
  // Reject unknown catalog segments up front. The resolved item carries its
  // authoritative catalog, so the raw route param is never used to build an
  // upstream request (the slug alone drives the lookup).
  if (!toContentType(rawType)) notFound()

  const result = await fetchBySlug(slug)
  if (!result) notFound()

  const activeType = result.type
  const related = await fetchRelated(activeType, slug, 6)

  return (
    <WatchInnerClient
      key={`${activeType}:${slug}`}
      item={result.item}
      type={activeType}
      related={related}
    />
  )
}
