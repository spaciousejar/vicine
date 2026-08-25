// components/trending-row-new.tsx
// Horizontal scrollable row for trending content
// Shows numbered rank, small poster, title, metadata

"use client"

import Link from "next/link"
import Image from "next/image"
import { motion } from "motion/react"
import type { MediaItem } from "@/lib/api"
import { getContentType, getImage, getYear } from "@/lib/api"

interface TrendingRowNewProps {
  items: MediaItem[]
}

export function TrendingRowNew({ items }: TrendingRowNewProps) {
  if (items.length === 0) return null

  return (
    <div className="scrollbar-hide flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4">
      {items.map((item, i) => {
        const img = getImage(item)
        const year = getYear(item)
        return (
          <motion.div
            key={item._id ?? item.url_slug}
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.05, duration: 0.4 }}
            className="w-48 flex-shrink-0 snap-start"
          >
            <Link href={`/watch/${getContentType(item)}/${item.url_slug}`}>
              <div className="group flex items-center gap-3">
                {/* Rank number */}
                <span className="w-8 text-right text-3xl font-bold text-zinc-700 tabular-nums transition-colors group-hover:text-emerald-500">
                  {i + 1}
                </span>

                {/* Small poster */}
                <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-zinc-800">
                  {img ? (
                    <Image
                      src={img}
                      alt={item.title}
                      fill
                      className="object-cover"
                      sizes="48px"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-zinc-500">
                      No image
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-100 transition-colors group-hover:text-emerald-400">
                    {item.title}
                  </p>
                  {year && <p className="text-xs text-zinc-500">{year}</p>}
                </div>
              </div>
            </Link>
          </motion.div>
        )
      })}
    </div>
  )
}
