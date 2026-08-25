"use client"

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"
import { Search, Menu, X } from "lucide-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const NAV = [
  { href: "/", label: "Home" },
  { href: "/movies", label: "Movies" },
  { href: "/anime", label: "Anime" },
  { href: "/series", label: "Series" },
] as const

function SiteHeaderInner() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState(searchParams.get("q") ?? "")

  function onSearch(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams(searchParams.toString())
    if (q.trim()) params.set("q", q.trim())
    else params.delete("q")
    params.delete("page")
    const watchMatch = pathname.match(/^\/watch\/(movies|anime|series)\b/)
    const base =
      pathname.startsWith("/movies") ||
      pathname.startsWith("/anime") ||
      pathname.startsWith("/series")
        ? pathname
        : watchMatch
          ? "/" + watchMatch[1]
          : "/movies"
    router.push(`${base}?${params.toString()}`)
    setOpen(false)
  }

  return (
    <>
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-safe sm:gap-4">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 font-semibold tracking-tight"
          aria-label="VICINE home"
        >
          <span className="flex size-8 items-center justify-center overflow-hidden rounded-lg bg-primary">
            <Image
              src="/icon-512.png"
              alt=""
              width={32}
              height={32}
              className="size-full object-cover"
              priority
            />
          </span>
          <span>VICINE</span>
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        <form
          onSubmit={onSearch}
          className="ml-auto hidden max-w-sm flex-1 items-center gap-2 sm:flex"
        >
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search titles..."
              aria-label="Search titles"
              className="pl-8"
            />
          </div>
          <Button type="submit" variant="secondary" size="sm">
            Search
          </Button>
        </form>

        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-nav"
        >
          {open ? (
            <X className="size-5" aria-hidden="true" />
          ) : (
            <Menu className="size-5" aria-hidden="true" />
          )}
        </Button>
      </div>

      {open && (
        <div id="mobile-nav" className="border-t bg-background md:hidden">
          <nav
            aria-label="Mobile"
            className="mx-auto flex max-w-7xl flex-col gap-1 px-safe py-3"
          >
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={pathname === item.href ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center rounded-md px-3 text-sm",
                  pathname === item.href
                    ? "bg-secondary"
                    : "text-muted-foreground"
                )}
              >
                {item.label}
              </Link>
            ))}
            <form onSubmit={onSearch} className="mt-2 flex gap-2">
              <div className="relative flex-1">
                <Search
                  className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search..."
                  aria-label="Search titles"
                  className="pl-8"
                />
              </div>
              <Button type="submit" size="lg">
                Go
              </Button>
            </form>
          </nav>
        </div>
      )}
    </>
  )
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <Suspense fallback={<div className="h-14" />}>
        <SiteHeaderInner />
      </Suspense>
    </header>
  )
}
