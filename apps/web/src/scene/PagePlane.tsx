import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useLoader } from '@react-three/fiber';

export interface PagePlaneProps { src: string; x: number; y: number; w: number; h: number; opacity: number; visible?: boolean }

/** A page is a 1 by 1.4 plane scaled to the scenario's page box. Textures are sRGB with anisotropy 16. */
export function PagePlane({ src, x, y, w, h, opacity, visible = true }: PagePlaneProps) {
  const tex = useLoader(THREE.TextureLoader, src);
  useEffect(() => { tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 16; tex.needsUpdate = true; }, [tex]);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }), [tex]);
  mat.opacity = opacity;
  return (
    <mesh position={[x + w / 2, -(y + h / 2), 0]} scale={[w, h / 1.4, 1]} visible={visible && opacity > 0.001} material={mat}>
      <planeGeometry args={[1, 1.4]} />
    </mesh>
  );
}
