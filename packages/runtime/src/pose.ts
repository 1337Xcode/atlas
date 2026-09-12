import type { LookHorizontal, LookVertical, WorldControlSettings } from '@atlas/schema'
import type { LookDelta } from './input.ts'

// docs: https://docs.reactor.inc/model-api-reference/lingbot-world-2/schema#set_camera_pose
// note: each latent is [rx, ry, rz, tx, ty, tz] — euler-radian rotation plus camera-local translation
// note: translation is max-norm normalised per chunk, so only sign and shape survive; +-1 is enough
// note: the vertical axis is y-down, so rising is negative ty

const UNIT = 1
const KEY_LOOK_RAD_PER_LATENT = 0.03

export type PoseInput = {
  look: LookDelta
  lookHorizontal: LookHorizontal
  lookVertical: LookVertical
  // note: +1 up / 0 still / -1 down for each latent of this chunk
  jumpLatents: readonly number[]
  crouchDip: 'down' | 'up' | null
  latents: number
  settings: WorldControlSettings
}

// fn: build one chunk of camera-pose deltas, or null when no look or vertical control is engaged
export function buildCameraPose(input: PoseInput): number[] | null {
  const { settings, latents } = input
  const limit = settings.maxRotationPerLatentRad

  // why: mouse deltas accumulate between sends and convert to one velocity, so a fling cannot over-rotate
  const yaw = clamp(
    input.look.dxPx * settings.lookSensitivity +
      direction(input.lookHorizontal, 'right') * KEY_LOOK_RAD_PER_LATENT,
    limit,
  )
  const pitchSign = settings.invertLookY ? -1 : 1
  const pitch = clamp(
    pitchSign *
      (input.look.dyPx * settings.lookSensitivity +
        direction(input.lookVertical, 'down') * KEY_LOOK_RAD_PER_LATENT),
    limit,
  )

  const vertical = verticalPerLatent(input)
  const engaged = yaw !== 0 || pitch !== 0 || vertical.some((value) => value !== 0)
  if (!engaged) return null

  const pose: number[] = []
  for (let latent = 0; latent < latents; latent += 1) {
    pose.push(pitch, yaw, 0, 0, vertical[latent] ?? 0, 0)
  }
  return pose
}

// fn: the per-latent ty channel, carrying the jump arc or a crouch dip
function verticalPerLatent(input: PoseInput): number[] {
  const dip = input.crouchDip === 'down' ? UNIT : input.crouchDip === 'up' ? -UNIT : 0
  return Array.from({ length: input.latents }, (_, latent) => {
    const jump = input.jumpLatents[latent] ?? 0
    // note: up is negative ty, so an arc value of +1 becomes -1 on the wire
    return -jump * UNIT + dip
  })
}

function direction(axis: LookHorizontal | LookVertical, positive: string): number {
  if (axis === 'idle') return 0
  return axis === positive ? 1 : -1
}

function clamp(value: number, limit: number): number {
  return Math.max(-limit, Math.min(limit, value))
}
