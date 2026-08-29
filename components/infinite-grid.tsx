"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2 } from "lucide-react"
import { MediaGrid } from "@/components/media-grid"
import type { ContentType, MediaItem } from "@/lib/api"

interface InfiniteGridProps {
  type: ContentType
  initialItems: MediaItem[]
  initialPage: number
  initialPages: number
  q?: string
  limit?: number
}

export function InfiniteGrid({
  type,
  initialItems,
  initialPage,
  initialPages,
  q = "",
  limit = 24,
}: InfiniteGridProps) {
  const [items, setItems] = useState<MediaItem[]>(initialItems)
  const [page, setPage] = useState(initialPage)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(initialPage < initialPages)
  const [error, setError] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const loadingRef = useRef(false)

  // Search results are a single flat page — never infinite-scroll them.
  const searchMode = q.trim().length > 0

  useEffect(() => {
    if (searchMode || !hasMore || loadingRef.current) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return
        if (loadingRef.current || !hasMore) return
        loadMore()
      },
      { rootMargin: "600px 0px 0px 0px" }
    )

    const sentinel = sentinelRef.current
    if (sentinel) observer.observe(sentinel)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchMode, hasMore, page])

  async function loadMore() {
    loadingRef.current = true
    setLoading(true)
    setError(false)
    try {
      const params = new URLSearchParams({ type, page: String(page + 1) })
      if (limit) params.set("limit", String(limit))
      const res = await fetch(`/api/list?${params.toString()}`)
      if (!res.ok) throw new Error("failed")
      const data = await res.json()
      const next = Array.isArray(data.data) ? (data.data as MediaItem[]) : []
      const seen = new Set(items.map((i) => i._id ?? i.url_slug))
      const deduped = next.filter((i) => !seen.has(i._id ?? i.url_slug))
      if (deduped.length > 0) {
        setItems((prev) => [...prev, ...deduped])
        setPage((p) => p + 1)
      }
      const pages = data.pagination?.pages ?? initialPages
      setHasMore(page + 1 < pages)
    } catch {
      setError(true)
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }

  function retry() {
    if (!hasMore || loadingRef.current) return
    loadMore()
  }

  return (
    <div className="min-w-0">
      <MediaGrid items={items} type={type} />

      <div ref={sentinelRef} aria-hidden="true" className="h-px" />

      {loading && (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Loading more
        </div>
      )}

      {error && (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            Couldn&apos;t load more titles.
          </p>
          <button
            type="button"
            onClick={retry}
            data-slot="button"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
          >
            Try again
          </button>
        </div>
      )}

      {!hasMore && !loading && !error && !searchMode && items.length > 0 && (
        <p className="py-10 text-center text-xs text-muted-foreground">
          You&apos;ve reached the end.
        </p>
      )}
    </div>
  )
}
