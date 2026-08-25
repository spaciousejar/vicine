import { Suspense } from "react"
import { SearchPageInner } from "./search-inner"

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-svh bg-background">
          <div className="mx-auto max-w-7xl px-safe py-6 pb-safe">
            <div className="h-12 w-full animate-pulse rounded-xl bg-muted" />
          </div>
        </div>
      }
    >
      <SearchPageInner />
    </Suspense>
  )
}
