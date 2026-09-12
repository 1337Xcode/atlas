import { useEffect, useMemo } from 'react'
import * as THREE from 'three'

export interface WorldPlaneProps {
  video: HTMLVideoElement | null
  x: number
  y: number
  w: number
  h: number
  mix: number
  visible: boolean
}

// note: a video texture over the illustration crop, hidden until there is actually a world to show
// why: with no video the page stays visible, instead of the reader facing a black rectangle
export function WorldPlane({ video, x, y, w, h, mix, visible }: WorldPlaneProps) {
  const tex = useMemo(() => (video ? new THREE.VideoTexture(video) : null), [video])
  useEffect(() => {
    if (tex) tex.colorSpace = THREE.SRGBColorSpace
    return () => tex?.dispose()
  }, [tex])
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: tex,
        color: tex ? 0xffffff : 0x0a0908,
        transparent: true,
        toneMapped: false,
      }),
    [tex],
  )
  mat.opacity = mix
  return (
    <mesh
      position={[x + w / 2, -(y + h / 2), 0.002]}
      scale={[w, h, 1]}
      visible={visible && mix > 0.001 && tex !== null}
      material={mat}
    >
      <planeGeometry args={[1, 1]} />
    </mesh>
  )
}
