import Link from "next/link"
import { Clapperboard } from "lucide-react"

export function Footer() {
  return (
    <footer className="mt-24 border-t">
      <div className="mx-auto max-w-7xl px-safe py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link
              href="/"
              className="flex items-center gap-2 font-semibold tracking-tight transition-opacity hover:opacity-80"
              aria-label="VICINE home"
            >
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Clapperboard className="size-4" aria-hidden="true" />
              </span>
              <span>VICINE</span>
            </Link>
            <p className="mt-2 text-sm text-muted-foreground">
              Watch movies, anime & series.
            </p>
          </div>

          {/* Browse */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-foreground">
              Browse
            </h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/movies"
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  Movies
                </Link>
              </li>
              <li>
                <Link
                  href="/anime"
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  Anime
                </Link>
              </li>
              <li>
                <Link
                  href="/series"
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  Series
                </Link>
              </li>
            </ul>
          </div>

          {/* Quality */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-foreground">
              Quality
            </h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/movies?quality=1080p"
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  1080p
                </Link>
              </li>
              <li>
                <Link
                  href="/movies?quality=720p"
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  720p
                </Link>
              </li>
              <li>
                <Link
                  href="/movies?quality=480p"
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  480p
                </Link>
              </li>
            </ul>
          </div>

          {/* Info */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-foreground">Info</h3>
            <ul className="space-y-2">
              <li>
                <span className="text-sm text-muted-foreground">
                  10,000+ titles
                </span>
              </li>
              <li>
                <span className="text-sm text-muted-foreground">
                  480p – 4K quality
                </span>
              </li>
              <li>
                <span className="text-sm text-muted-foreground">
                  Dual audio available
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t pt-8 text-center">
          <p className="text-xs text-muted-foreground">
            VICINE &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </footer>
  )
}
