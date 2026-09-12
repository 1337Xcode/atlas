import { motion } from 'framer-motion'
// why: the box shape belongs to the scenario contract, so it is not declared twice
import type { TranslationBox } from '../data/types'
/** An English rendering typeset over a foreign language block, positioned in page UV and projected by the caller. Marked generated so the provenance toggle hides it. */
export function Translation({
  box,
  rect,
  visible,
  scale,
}: {
  box: TranslationBox | null
  rect: { x: number; y: number; w: number; h: number } | null
  visible: boolean
  scale: number
}) {
  if (!box || !rect) return null
  const fs = box.size * scale
  const isHead = box.weight === 700 && !box.heading
  return (
    <motion.div
      className="pointer-events-none fixed"
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        padding: rect.w * 0.04,
        background: 'rgba(246,240,228,0.96)',
        color: '#1a1714',
        fontFamily: 'Georgia, serif',
        overflow: 'hidden',
      }}
      animate={{ opacity: visible ? 1 : 0 }}
      transition={{ duration: 1.6, ease: [0.65, 0, 0.35, 1] }}
    >
      {(box.heading || isHead) && (
        <div
          style={{
            fontWeight: 700,
            lineHeight: 1.05,
            fontSize: box.heading ? fs * 1.35 : fs,
            marginBottom: box.heading ? fs * 0.6 : 0,
          }}
        >
          {box.heading ?? box.text}
        </div>
      )}
      <div style={{ lineHeight: 1.32, textAlign: 'justify', fontSize: isHead ? fs * 0.28 : fs }}>
        {isHead ? box.sub : box.text}
      </div>
      <span
        className="ui absolute bottom-0 right-0"
        style={{
          color: 'rgba(26,23,20,0.5)',
          fontSize: Math.min(fs * 0.75, scale * 0.008),
          padding: rect.w * 0.02 + 'px ' + rect.w * 0.04 + 'px',
        }}
      >
        English rendering
      </span>
    </motion.div>
  )
}
