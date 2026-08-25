// components/skeleton.tsx
// Loading placeholders that match the final layout shape

export function CardSkeleton() {
  return (
    <div className="space-y-3">
      {/* Poster placeholder — 2:3 aspect ratio */}
      <div className="skeleton aspect-[2/3] w-full" />
      {/* Title placeholder */}
      <div className="skeleton h-5 w-3/4" />
      {/* Metadata placeholder */}
      <div className="skeleton h-3 w-1/2" />
    </div>
  )
}

export function HeroSkeleton() {
  return (
    <div className="relative w-full h-[70vh]">
      <div className="skeleton absolute inset-0" />
      <div className="absolute bottom-0 left-0 right-0 p-8 space-y-4">
        <div className="skeleton h-4 w-32" />
        <div className="skeleton h-12 w-2/3" />
        <div className="skeleton h-4 w-1/2" />
        <div className="skeleton h-10 w-32" />
      </div>
    </div>
  )
}

export function TrendingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex gap-4 items-center p-3">
          <div className="skeleton h-16 w-12 shrink-0" />
          <div className="space-y-2 flex-1">
            <div className="skeleton h-4 w-3/4" />
            <div className="skeleton h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}
