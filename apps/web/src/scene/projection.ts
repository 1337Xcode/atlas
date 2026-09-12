// why: the overlay draws in screen pixels over a 3d scene, so both must agree on the projection

export type Viewport = { width: number; height: number }

export type CameraView = { x: number; y: number; z: number }

// note: the vertical half-angle of the scene camera, matching the rig's 35 degree field of view
export const CAMERA_FOV_DEG = 35

export type Projector = {
  // fn: scene units to screen pixels
  toScreen: (u: number, v: number) => [number, number]
  // fn: screen pixels to the 0..1 range a shader uniform wants, with y flipped
  toUnit: (px: number, py: number) => [number, number]
  // note: pixels per scene unit at the camera's distance
  scale: number
}

export function createProjector(viewport: Viewport, camera: CameraView): Projector {
  const halfAngle = ((CAMERA_FOV_DEG / 2) * Math.PI) / 180
  // why: guard the divide, because a zero height or distance would produce NaN across the overlay
  const distance = camera.z === 0 ? Number.EPSILON : camera.z
  const scale = viewport.height / (2 * Math.tan(halfAngle)) / distance

  return {
    scale,
    toScreen: (u, v) => [
      viewport.width / 2 + (u - camera.x) * scale,
      viewport.height / 2 + (v - camera.y) * scale,
    ],
    toUnit: (px, py) => [
      viewport.width === 0 ? 0 : px / viewport.width,
      viewport.height === 0 ? 0 : 1 - py / viewport.height,
    ],
  }
}
