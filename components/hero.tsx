// components/hero.tsx
// Full-width hero banner for featured content
// Shows: background image, featured badge, title, description, CTA

'use client'

import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'motion/react'
import { Badge } from './badge'
import type { MediaItem, ContentType } from '@/lib/api'
import { getImage, getCategories } from '@/lib/api'

interface HeroProps {
  item: MediaItem
  type: ContentType
}

export function Hero({ item, type }: HeroProps) {
  const img = getImage(item)
  const cats = getCategories(item)

  return (
    <section className="relative w-full h-[70vh] min-h-[500px] overflow-hidden">
      {/* Background image */}
      {img ? (
        <Image
          src={img}
          alt={item.title}
          fill
          priority
          className="object-cover object-top"
          sizes="100vw"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-zinc-800 text-zinc-500">
          No image
        </div>
      )}

      {/* Gradient overlay — ensures text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/80 to-transparent" />

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12 lg:p-16 max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-4"
        >
          {/* Tags */}
          <div className="flex gap-2">
            {cats.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="genre">{tag}</Badge>
            ))}
          </div>

          {/* Title */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold text-white tracking-tight leading-[1.1]">
            {item.title}
          </h1>

          {/* Description */}
          <p className="text-zinc-300 text-base md:text-lg max-w-xl leading-relaxed">
            {item.excerpt ?? "Watch in 480p, 720p, 1080p — streaming via VICINE."}
          </p>

          {/* CTA */}
          <div className="flex gap-3 pt-2">
            <Link
              href={`/watch/${type}/${item.url_slug}`}
              className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
            >
              Watch now
            </Link>
            <Link
              href={`/${type}`}
              className="inline-flex items-center gap-2 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 font-medium px-6 py-3 rounded-lg backdrop-blur-sm transition-colors"
            >
              Browse {type}
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
