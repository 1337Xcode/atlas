import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useLoader } from '@react-three/fiber'

export interface PagePlaneProps {
  src: string
  x: number
  y: number
  w: number
  h: number
  opacity: number
  visible?: boolean
}

// note: a page is a 1 by 1.4 plane scaled to the scenario's page box
// perf: the scans are ~1900x4000, and anisotropy costs a tap per level on every sample
// why: 4 is indistinguishable from 16 on a plane the reader views nearly head on
export function PagePlane({ src, x, y, w, h, opacity, visible = true }: PagePlaneProps) {
  const tex = useLoader(THREE.TextureLoader, src)
  useEffect(() => {
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    tex.generateMipmaps = true
    tex.minFilter = THREE.LinearMipmapLinearFilter
    tex.needsUpdate = true
  }, [tex])
  const mat = useMemo(
    () => new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }),
    [tex],
  )
  // why: turning to another front page would otherwise strand a material on the gpu
  useEffect(() => () => mat.dispose(), [mat])
  mat.opacity = opacity
  return (
    <mesh
      position={[x + w / 2, -(y + h / 2), 0]}
      scale={[w, h / 1.4, 1]}
      visible={visible && opacity > 0.001}
      material={mat}
    >
      <planeGeometry args={[1, 1.4]} />
    </mesh>
  )
}
