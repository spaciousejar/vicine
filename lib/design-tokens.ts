// lib/design-tokens.ts
// Central design tokens — change these to retheme the entire site.
// Most styling flows through Tailwind CSS variables in globals.css;
// this file exists for programmatic access (motion, conditional classes).

export const tokens = {
  // Colors — mirrors the OKLCH vars in globals.css
  colors: {
    background: {
      primary: "bg-background",
      secondary: "bg-card",
      elevated: "bg-accent",
    },
    text: {
      primary: "text-foreground",
      secondary: "text-muted-foreground",
      muted: "text-muted-foreground/60",
    },
    accent: {
      primary: "bg-primary",
      text: "text-primary",
    },
    badge: {
      quality: "bg-blue-500/20 text-blue-300",
      genre: "bg-purple-500/20 text-purple-300",
      year: "bg-secondary text-secondary-foreground",
      new: "bg-emerald-500/20 text-emerald-300",
    },
  },

  // Typography
  fonts: {
    display: "font-semibold tracking-tight",
    heading: "font-semibold",
    body: "font-normal",
    meta: "text-xs font-medium",
  },

  // Spacing
  spacing: {
    section: "py-12 md:py-16",
    container: "px-safe",
    grid: "gap-4 md:gap-6",
  },

  // Border radius — locked to one system
  radius: {
    card: "rounded-xl",
    badge: "rounded-full",
    button: "rounded-lg",
  },

  // Shadows
  shadows: {
    card: "shadow-sm",
    cardHover: "shadow-md",
    elevated: "shadow-lg",
  },

  // Motion presets — spring configs for motion/react
  motion: {
    hover: { scale: 1.03, y: -4 },
    entrance: { opacity: 0, y: 30 },
    exit: { opacity: 0, y: -10 },
    spring: { type: "spring" as const, stiffness: 300, damping: 20 },
    ease: [0.16, 1, 0.3, 1] as const,
  },
} as const
