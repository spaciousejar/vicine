import Link from "next/link"
import { SiteHeader } from "@/components/site-header"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default function NotFound() {
  return (
    <div className="min-h-svh bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-safe py-24 pb-safe text-center">
        <p className="text-7xl font-bold tracking-tighter text-muted-foreground/30">
          404
        </p>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">
          Page not found
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            href="/"
            data-slot="button"
            className={cn(buttonVariants({ size: "lg" }))}
          >
            Go home
          </Link>
          <Link
            href="/movies"
            data-slot="button"
            className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
          >
            Browse movies
          </Link>
        </div>
      </main>
    </div>
  )
}
