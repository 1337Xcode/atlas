import { useEffect, useRef } from 'react'
import OpenSeadragon from 'openseadragon'
import { motion } from 'framer-motion'
import { localPaths } from '../data/paths'
import type { Cluster } from '../data/types'

export interface HubHandoff {
  bounds: { x: number; y: number; width: number; height: number }
  pageId: string
}

// note: the pages sit in a row, controls hidden, and selecting one hands its framing back
// note: flat scans with the `image` tile source; swap in a `.dzi` pyramid once tiles are generated
export function Hub({
  cluster,
  resolved,
  visible,
  onSelect,
}: {
  cluster: Cluster
  resolved: string[]
  visible: boolean
  onSelect: (h: HubHandoff) => void
}) {
  const el = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!el.current) return
    const viewer = OpenSeadragon({
      element: el.current,
      showNavigationControl: false,
      showNavigator: false,
      animationTime: 2.4,
      springStiffness: 3,
      visibilityRatio: 1,
      gestureSettingsMouse: { clickToZoom: false },
    })
    cluster.pages.forEach((p, i) =>
      viewer.addTiledImage({
        tileSource: { type: 'image', url: localPaths.asset(p.thumb) },
        x: i * 1.12,
        y: 0,
        width: 1,
      }),
    )
    viewer.addHandler('canvas-click', (e) => {
      const point = viewer.viewport.pointFromPixel(e.position)
      const idx = Math.floor(point.x / 1.12)
      const page = cluster.pages[idx]
      if (!page) return
      const b = viewer.viewport.getBounds()
      onSelect({ bounds: { x: b.x, y: b.y, width: b.width, height: b.height }, pageId: page.id })
    })
    return () => viewer.destroy()
  }, [cluster, onSelect])
  return (
    <motion.div
      className="fixed inset-0"
      animate={{ opacity: visible ? 1 : 0 }}
      transition={{ duration: 1.2 }}
      style={{ pointerEvents: visible ? 'auto' : 'none' }}
    >
      <div ref={el} className="h-full w-full" />
      <div className="ui pointer-events-none fixed bottom-[18vh] left-0 right-0 flex justify-center gap-16">
        {cluster.pages.map((p) => (
          <span key={p.id} className="flex flex-col items-center gap-1">
            <span>{p.title}</span>
            {resolved.includes(p.id) && (
              <span style={{ color: 'rgba(255,178,86,0.85)' }}>Resolved</span>
            )}
          </span>
        ))}
      </div>
    </motion.div>
  )
}
