import { notFound } from "next/navigation"
import { CONTENT_TYPES, fetchBySlug, fetchRelated } from "@/lib/api"
import type { ContentType } from "@/lib/api"
import { WatchInnerClient } from "./watch-inner"

export const revalidate = 300

export default async function WatchPage({
  params,
}: {
  params: Promise<{ type: string; slug: string }>
}) {
  const { type: rawType, slug } = await params
  const type = rawType as ContentType
  if (!CONTENT_TYPES.includes(type)) notFound()

  const result = await fetchBySlug(slug)
  if (!result) notFound()

  const activeType = (result.type as ContentType) ?? type
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
