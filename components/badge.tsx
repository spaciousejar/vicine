// components/badge.tsx
// Consistent badge system for quality, genre, year labels

import { tokens } from '@/lib/design-tokens'

type BadgeVariant = 'quality' | 'genre' | 'year' | 'new'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
}

const variantStyles: Record<BadgeVariant, string> = {
  quality: tokens.colors.badge.quality,
  genre: tokens.colors.badge.genre,
  year: tokens.colors.badge.year,
  new: tokens.colors.badge.new,
}

export function Badge({ children, variant = 'genre' }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center
        px-2.5 py-0.5
        ${tokens.radius.badge}
        ${tokens.fonts.meta}
        ${variantStyles[variant]}
      `}
    >
      {children}
    </span>
  )
}
