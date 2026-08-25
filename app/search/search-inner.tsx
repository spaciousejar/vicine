"use client"

import { useState, useEffect, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { SiteHeader } from "@/components/site-header"
import { MediaGrid, MediaGridSkeleton } from "@/components/media-grid"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"
import type { ContentType, MediaItem } from "@/lib/api"

interface SearchResult extends MediaItem {
  inferredType: ContentType
}

export function SearchPageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const initialQuery = searchParams.get("q") || ""

  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([])
      setSearched(false)
      return
    }
    setLoading(true)
    setSearched(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`)
      const data = await res.json()
      setResults(data.results ?? [])
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounced search on query change
  useEffect(() => {
    const timer = setTimeout(() => {
      doSearch(query)
    }, 300)
    return () => clearTimeout(timer)
  }, [query, doSearch])

  // Sync URL params on submit
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (query.trim()) params.set("q", query.trim())
    router.push(`/search?${params.toString()}`)
  }

  return (
    <div className="min-h-svh bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-safe py-6 pb-safe">
        {/* Search input */}
        <form onSubmit={handleSubmit} className="mx-auto mb-8 max-w-2xl">
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search movies, anime, series..."
              aria-label="Search titles"
              className="h-12 pl-11 text-base"
              autoFocus
            />
          </div>
        </form>

        {/* Results */}
        {loading ? (
          <MediaGridSkeleton count={10} />
        ) : results.length > 0 ? (
          <>
            <p className="mb-4 text-sm text-muted-foreground">
              {results.length} result{results.length !== 1 ? "s" : ""} for
              &ldquo;{query}&rdquo;
            </p>
            {(() => {
              const groups = results.reduce(
                (acc, item) => {
                  const t = (item.inferredType ?? "movies") as ContentType
                  acc[t].push(item)
                  return acc
                },
                {
                  movies: [] as SearchResult[],
                  anime: [] as SearchResult[],
                  series: [] as SearchResult[],
                }
              )

              return (["movies", "anime", "series"] as const)
                .filter((t) => groups[t].length > 0)
                .map((t) => <MediaGrid key={t} items={groups[t]} type={t} />)
            })()}
          </>
        ) : searched && query.trim() ? (
          <div className="py-20 text-center">
            <p className="text-lg text-muted-foreground">No results found</p>
            <p className="mt-2 text-sm text-muted-foreground/60">
              Try a different search term
            </p>
          </div>
        ) : (
          <div className="py-20 text-center">
            <p className="text-lg text-muted-foreground">
              Start typing to search
            </p>
            <p className="mt-2 text-sm text-muted-foreground/60">
              Search across movies, anime, and series
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
