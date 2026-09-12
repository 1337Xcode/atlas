import { motion } from 'framer-motion'
import type { Cluster } from '../data/types'

// why: the front pages are drawn by the scene, which the scenario's beats animate directly
// why: a second tiled copy on top of them showed the same pages twice and fought the scripted camera
// note: this layer is now only the page captions and the invitation to step in

export interface HubHandoff {
  pageId: string
}

export function Hub({
  cluster,
  resolved,
  visible,
  onSelect,
}: {
  cluster: Cluster
  resolved: string[]
  visible: boolean
  onSelect: (handoff: HubHandoff) => void
}) {
  const first = cluster.pages[0]

  return (
    <motion.div
      className="fixed inset-0"
      animate={{ opacity: visible ? 1 : 0 }}
      transition={{ duration: 1.2 }}
      style={{ pointerEvents: visible ? 'auto' : 'none' }}
      onClick={() => {
        if (first) onSelect({ pageId: first.id })
      }}
    >
      <div className="ui pointer-events-none fixed bottom-[18vh] left-0 right-0 flex flex-wrap justify-center gap-8 px-6 sm:gap-16">
        {cluster.pages.map((page) => (
          <span key={page.id} className="flex flex-col items-center gap-1 text-center">
            <span>{page.title}</span>
            {resolved.includes(page.id) && (
              <span style={{ color: 'rgba(255,178,86,0.85)' }}>Resolved</span>
            )}
          </span>
        ))}
      </div>

      <div className="ui pointer-events-none fixed bottom-[9vh] left-0 right-0 flex justify-center">
        <span style={{ opacity: 0.55 }}>click anywhere to read the front page</span>
      </div>
    </motion.div>
  )
}
