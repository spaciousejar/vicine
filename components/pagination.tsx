"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { buttonVariants } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

function PaginationInner({
  page,
  pages,
  total,
}: {
  page: number
  pages: number
  total: number
}) {
  const pathname = usePathname()
  const sp = useSearchParams()

  function href(p: number) {
    const params = new URLSearchParams(sp.toString())
    params.set("page", String(p))
    return `${pathname}?${params.toString()}`
  }

  const windowPages = getWindow(page, pages)

  return (
    <div className="flex flex-col items-center gap-3 py-6">
      {/* data-slot="button" opts these anchors into the coarse-pointer tap
          target floor in globals.css, same as a real <Button>. */}
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {page > 1 ? (
          <Link
            href={href(page - 1)}
            data-slot="button"
            className={buttonVariants({ variant: "outline", size: "icon" })}
            aria-label="Previous page"
          >
            <ChevronLeft className="size-4" />
          </Link>
        ) : (
          <span
            aria-disabled
            data-slot="button"
            className={cn(
              buttonVariants({ variant: "outline", size: "icon" }),
              "pointer-events-none opacity-50"
            )}
          >
            <ChevronLeft className="size-4" />
          </span>
        )}
        {windowPages.map((p, i) =>
          p === "..." ? (
            <span key={`e-${i}`} className="px-2 text-sm text-muted-foreground">
              …
            </span>
          ) : (
            <Link
              key={p}
              href={href(p as number)}
              data-slot="button"
              aria-current={p === page ? "page" : undefined}
              className={cn(
                buttonVariants({
                  variant: p === page ? "default" : "outline",
                  size: "sm",
                }),
                "min-w-9"
              )}
            >
              {p}
            </Link>
          )
        )}
        {page < pages ? (
          <Link
            href={href(page + 1)}
            data-slot="button"
            className={buttonVariants({ variant: "outline", size: "icon" })}
            aria-label="Next page"
          >
            <ChevronRight className="size-4" />
          </Link>
        ) : (
          <span
            aria-disabled
            data-slot="button"
            className={cn(
              buttonVariants({ variant: "outline", size: "icon" }),
              "pointer-events-none opacity-50"
            )}
          >
            <ChevronRight className="size-4" />
          </span>
        )}
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Page {page} of {pages} — {total.toLocaleString()} titles
      </p>
    </div>
  )
}

export function AppPagination(props: {
  page: number
  pages: number
  total: number
}) {
  return (
    <Suspense
      fallback={
        <div className="py-6 text-center text-xs text-muted-foreground">
          Loading…
        </div>
      }
    >
      <PaginationInner {...props} />
    </Suspense>
  )
}

function getWindow(page: number, pages: number): (number | "...")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1)
  const out: (number | "...")[] = [1]
  if (page > 3) out.push("...")
  for (let p = Math.max(2, page - 1); p <= Math.min(pages - 1, page + 1); p++)
    out.push(p)
  if (page < pages - 2) out.push("...")
  out.push(pages)
  return out
}
