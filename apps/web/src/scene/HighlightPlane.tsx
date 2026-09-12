import { useMemo } from 'react'
import * as THREE from 'three'
import { useLoader } from '@react-three/fiber'
import frag from '../shaders/highlight.frag'

const vert =
  'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }'

export interface HighlightProps {
  src: string
  x: number
  y: number
  w: number
  h: number
  box: [number, number, number, number]
  strength: number
  desat: number
  marks: [number, number, number, number][]
  provenance: boolean
}

/** Sits 0.001 in front of the page and redraws it with the word wash, the column desaturation and up to 8 provenance rules. */
export function HighlightPlane({
  src,
  x,
  y,
  w,
  h,
  box,
  strength,
  desat,
  marks,
  provenance,
}: HighlightProps) {
  const tex = useLoader(THREE.TextureLoader, src)
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag,
        transparent: true,
        uniforms: {
          uMap: { value: tex },
          uBox: { value: new THREE.Vector4() },
          uStrength: { value: 0 },
          uDesat: { value: 0 },
          uMarks: { value: Array.from({ length: 8 }, () => new THREE.Vector4()) },
          uMarkCount: { value: 0 },
          uProvenance: { value: 0 },
        },
      }),
    [tex],
  )
  const box4 = material.uniforms.uBox!.value as THREE.Vector4
  box4.set(box[0], 1 - box[1] - box[3], box[2], box[3])
  material.uniforms.uStrength!.value = strength
  material.uniforms.uDesat!.value = provenance ? 0 : desat
  marks
    .slice(0, 8)
    .forEach((m, i) =>
      (material.uniforms.uMarks!.value as THREE.Vector4[])[i]!.set(
        m[0],
        1 - m[1] - m[3],
        m[2],
        m[3],
      ),
    )
  material.uniforms.uMarkCount!.value = Math.min(8, marks.length)
  material.uniforms.uProvenance!.value = provenance ? 1 : 0
  return (
    <mesh position={[x + w / 2, -(y + h / 2), 0.001]} scale={[w, h / 1.4, 1]} material={material}>
      <planeGeometry args={[1, 1.4]} />
    </mesh>
  )
}
