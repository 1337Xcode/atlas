import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

export interface WorldPlaneProps { video: HTMLVideoElement | null; x: number; y: number; w: number; h: number; mix: number; visible: boolean }

/** A VideoTexture over the illustration crop. Hidden until the world phase. The dot dissolve runs in the composer pass. */
export function WorldPlane({ video, x, y, w, h, mix, visible }: WorldPlaneProps) {
  const tex = useMemo(() => (video ? new THREE.VideoTexture(video) : null), [video]);
  useEffect(() => { if (tex) tex.colorSpace = THREE.SRGBColorSpace; return () => tex?.dispose(); }, [tex]);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ map: tex ?? undefined, color: tex ? 0xffffff : 0x0a0908, transparent: true, toneMapped: false }), [tex]);
  mat.opacity = mix;
  return (
    <mesh position={[x + w / 2, -(y + h / 2), 0.002]} scale={[w, h, 1]} visible={visible && mix > 0.001} material={mat}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}
