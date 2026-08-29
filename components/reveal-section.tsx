"use client"

import type { ReactNode } from "react"
import { motion, useReducedMotion } from "motion/react"

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
  const reduce = useReducedMotion()

  return (
    <motion.section
      className={className}
      initial={reduce ? false : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.section>
  )
}
