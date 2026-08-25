// components/content-card.tsx
// The main card used on homepage, movies, anime, and series pages
// Features: poster, badges, title, hover effect, loading state

'use client'

import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'motion/react'
import { Badge } from './badge'
import { CardSkeleton } from './skeleton'
import type { ContentType, MediaItem } from '@/lib/api'
import { getImage, getYear, getCategories } from '@/lib/api'

interface ContentCardProps {
  item: MediaItem
  type: ContentType
  loading?: boolean
}

function getBadgeVariant(tag: string): 'quality' | 'genre' | 'year' | 'new' {
  if (['1080p', '720p', '480p', '4K'].includes(tag)) return 'quality'
  if (tag === 'New') return 'new'
  if (/^\d{4}$/.test(tag)) return 'year'
  return 'genre'
}

export function ContentCard({ item, type, loading }: ContentCardProps) {
  if (loading) return <CardSkeleton />

  const img = getImage(item)
  const year = getYear(item)
  const cats = getCategories(item)

  return (
    <Link href={`/watch/${type}/${item.url_slug}`}>
      <motion.article
        whileHover={{ scale: 1.03, y: -4 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="group cursor-pointer space-y-3"
      >
        {/* Poster */}
        <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-zinc-800">
          {img ? (
            <Image
              src={img}
              alt={item.title}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-zinc-800 text-xs text-zinc-500">
              No image
            </div>
          )}

          {/* Year badge — top left */}
          {year && (
            <div className="absolute top-2 left-2">
              <Badge variant="year">{year}</Badge>
            </div>
          )}

          {/* Quality badge — top right */}
          {cats.some(c => ['1080p', '720p', '480p', '4K'].includes(c)) && (
            <div className="absolute top-2 right-2">
              <Badge variant="quality">
                {cats.find(c => ['1080p', '720p', '480p', '4K'].includes(c))}
              </Badge>
            </div>
          )}

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </div>

        {/* Title */}
        <h3 className="font-semibold text-zinc-50 text-sm leading-tight line-clamp-2 group-hover:text-emerald-400 transition-colors">
          {item.title}
        </h3>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5">
          {cats.slice(0, 3).map((tag) => (
            <Badge key={tag} variant={getBadgeVariant(tag)}>
              {tag}
            </Badge>
          ))}
        </div>
      </motion.article>
    </Link>
  )
}
