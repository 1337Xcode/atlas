import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { PerspectiveCamera } from '@react-three/drei'
import { drift } from '../sequence/beats'

export interface RigTarget {
  x: number
  y: number
  z: number
  trackY: number | null
}

/** Camera fov 35, near 0.01, far 100. Reads the sheet each frame, adds the hold drift, and smooths tracked reads with a 0.6 s exponential filter. */
export function CameraRig({ target, time }: { target: RigTarget; time: number }) {
  const smoothed = useRef<number | null>(null)
  const { camera } = useThree()
  useFrame((_, dt) => {
    const d = drift(time)
    let y = target.y
    if (target.trackY !== null) {
      smoothed.current =
        smoothed.current === null
          ? y
          : smoothed.current + (target.trackY - smoothed.current) * (1 - Math.exp(-dt / 0.6))
      y = smoothed.current
    } else smoothed.current = null
    camera.position.set(target.x + d.x, -(y + d.y), target.z)
    camera.lookAt(target.x + d.x, -(y + d.y), 0)
  })
  return <PerspectiveCamera makeDefault fov={35} near={0.01} far={100} />
}
