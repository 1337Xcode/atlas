'use client'

import { useState } from 'react'
import { Play } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type HoverPlayCardProps = {
  poster: string
  alt: string
  href: string
  label: string
  className?: string
  onImageError?: () => void
}

// feat: adapt the supplied centered play card to an explicit world link, never hover-start a session
export function HoverPlayCard({
  poster,
  alt,
  href,
  label,
  className,
  onImageError,
}: HoverPlayCardProps) {
  const [hovering, setHovering] = useState(false)
  const reducedMotion = useReducedMotion()
  return (
    <div
      className={cn(
        'relative rounded-xl overflow-hidden shadow-sm group',
        'paper-world',
        className,
      )}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <img
        src={poster}
        alt={alt}
        draggable={false}
        fetchPriority="high"
        onError={onImageError}
        className="w-full h-full object-cover"
      />
      <motion.div
        initial={false}
        animate={{ opacity: hovering ? 1 : 0.9 }}
        transition={{ duration: reducedMotion ? 0 : 0.18 }}
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
      >
        <Button
          asChild
          size="icon"
          variant="ghost"
          className="pointer-events-auto bg-black/20 hover:bg-black/40 text-white rounded-full w-16 h-16 world-play-button"
        >
          <a href={href} aria-label={label}>
            <Play className="w-8 h-8" aria-hidden="true" />
          </a>
        </Button>
      </motion.div>
    </div>
  )
}
