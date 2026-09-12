import { useEffect, useState } from 'react'
import type { Viewport } from '../scene/projection'

// why: the overlay is laid out in pixels, so a resize or a rotation has to reflow it
// note: visualViewport is used where it exists, since mobile browser chrome changes the usable size
function read(): Viewport {
  if (typeof window === 'undefined') return { width: 0, height: 0 }
  const visual = window.visualViewport
  return {
    width: Math.round(visual?.width ?? window.innerWidth),
    height: Math.round(visual?.height ?? window.innerHeight),
  }
}

export function useViewport(): Viewport {
  const [viewport, setViewport] = useState<Viewport>(read)

  useEffect(() => {
    // perf: one state update per frame at most, since resize fires in bursts while dragging
    let frame = 0
    const onResize = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => setViewport(read()))
    }

    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)
    window.visualViewport?.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
      window.visualViewport?.removeEventListener('resize', onResize)
    }
  }, [])

  return viewport
}
