import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { usePhases } from '../sequence/phases'

export interface ProjectedMark {
  label: string
  source: string
  x: number
  y: number
  w: number
  h: number
  visible: boolean
  outline?: boolean
}

/** Labels live in the DOM and are projected from page UV each frame by the caller. The key p toggles the provenance state at any phase. */
export function Provenance({ marks }: { marks: ProjectedMark[] }) {
  const { provenanceVisible, toggleProvenance } = usePhases()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'p' || e.key === 'P') toggleProvenance()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleProvenance])
  return (
    <div className="pointer-events-none fixed inset-0 ui">
      {marks.map((m, i) => (
        <motion.div
          key={i}
          className="absolute left-0 top-0"
          style={{ transform: 'translate(' + m.x + 'px,' + m.y + 'px)' }}
          animate={{ opacity: m.visible || provenanceVisible ? 1 : 0 }}
          transition={{ duration: 1.2 }}
        >
          <div
            className="absolute left-0 top-0"
            style={{
              width: m.w,
              height: m.h,
              borderRight: '1px solid rgba(235,230,220,0.7)',
              border: m.outline ? '1px solid rgba(235,230,220,0.7)' : undefined,
            }}
          />
          <div
            className="absolute top-0 flex flex-col gap-1 whitespace-nowrap pl-2.5"
            style={{ left: m.w }}
          >
            <span>{m.label}</span>
            {provenanceVisible && <span style={{ opacity: 0.5 }}>{m.source}</span>}
          </div>
        </motion.div>
      ))}
      <motion.div
        className="absolute right-8 px-3 py-2"
        style={{
          top: 'calc(12vh + 24px)',
          background: 'rgba(8,7,6,0.8)',
          maxWidth: '34ch',
          textAlign: 'right',
        }}
        animate={{ opacity: provenanceVisible ? 1 : 0 }}
        transition={{ duration: 0.4 }}
      >
        Provenance on. Generated and synthetic layers hidden.
      </motion.div>
    </div>
  )
}
