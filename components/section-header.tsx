import Link from "next/link"
import { cn } from "@/lib/utils"

interface SectionHeaderProps {
  title: string
  href?: string
  icon?: React.ReactNode
  count?: number
  className?: string
}

export function SectionHeader({
  title,
  href,
  icon,
  count,
  className,
}: SectionHeaderProps) {
  return (
    <div
      className={cn("mb-3 flex items-center justify-between gap-3", className)}
    >
      <h2 className="flex min-w-0 items-center gap-2 text-lg font-semibold tracking-tight">
        {icon}
        {title}
        {count !== undefined && (
          <span className="text-base font-normal text-muted-foreground">
            {count.toLocaleString()}
          </span>
        )}
      </h2>
      {href && (
        <Link
          href={href}
          data-slot="button"
          className="shrink-0 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          View all →
        </Link>
      )}
    </div>
  )
}
