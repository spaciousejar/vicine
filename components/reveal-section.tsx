import type { ReactNode } from "react"

interface RevealSectionProps {
  children: ReactNode
  delay?: number
  className?: string
}

export function RevealSection({
  children,
  delay = 0,
  className,
}: RevealSectionProps) {
  return (
    <section
      className={className}
      style={{
        animationDelay: delay ? `${delay}s` : undefined,
      }}
    >
      {children}
    </section>
  )
}
