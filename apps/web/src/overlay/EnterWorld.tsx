import { motion } from 'framer-motion'
import { localPaths } from '../data/paths'

// feat: the doorway from a front page into its world, drawn over the page it was built from
export function EnterWorld({
  title,
  date,
  poster,
  href,
  visible,
}: {
  title: string
  date: string
  poster: string
  href: string
  visible: boolean
}) {
  return (
    <motion.a
      href={href}
      className="ui fixed bottom-6 right-6 z-10 flex w-[min(88vw,22rem)] flex-col gap-3 overflow-hidden"
      initial={false}
      animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : 12 }}
      transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
      style={{
        pointerEvents: visible ? 'auto' : 'none',
        background: 'rgba(8,8,9,0.82)',
        border: '1px solid rgba(235,230,220,0.18)',
        color: 'inherit',
        textDecoration: 'none',
      }}
    >
      <div
        className="relative aspect-[1664/960] w-full overflow-hidden"
        style={{ background: '#0a0908' }}
      >
        <img
          src={localPaths.asset(poster)}
          alt=""
          className="h-full w-full object-cover"
          style={{ filter: 'grayscale(0.35) contrast(1.05)' }}
        />
        {/* note: the invitation sits on the picture the world is anchored to */}
        <span
          className="absolute inset-0 flex items-center justify-center"
          style={{
            background: 'radial-gradient(circle at center, rgba(0,0,0,0.05), rgba(0,0,0,0.55))',
            color: 'rgba(245,241,232,0.95)',
            fontFamily: 'Georgia, serif',
            fontSize: 'clamp(1.1rem, 0.9rem + 0.8vw, 1.5rem)',
            letterSpacing: '0.02em',
          }}
        >
          Enter the world
        </span>
      </div>
      <div className="flex flex-col gap-1 px-4 pb-4">
        <span style={{ opacity: 0.9 }}>{title}</span>
        <span style={{ opacity: 0.5 }}>{date}</span>
        <span style={{ opacity: 0.4, marginTop: '0.35rem', lineHeight: 1.5 }}>
          Walk with W A S D, look with the mouse. Escape leaves.
        </span>
      </div>
    </motion.a>
  )
}
