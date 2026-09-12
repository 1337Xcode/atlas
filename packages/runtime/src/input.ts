import {
  type ControlIntent,
  type Lateral,
  type Longitudinal,
  type LookHorizontal,
  type LookVertical,
  type SceneInputState,
} from '@atlas/schema'

// why: movement is persistent state on the wire, so every press needs a matching release
// docs: https://docs.reactor.inc/model-api-reference/lingbot-world-2/tutorial#driving-with-wasd

export type HoldAction =
  | 'forward'
  | 'back'
  | 'strafe-left'
  | 'strafe-right'
  | 'turn-left'
  | 'turn-right'
  | 'look-up'
  | 'look-down'
  | 'crouch'

// note: a symmetric grid of +1 up / -1 down per latent, so the reader lands where they launched
const JUMP_ARC: readonly number[] = [1, 1, 1, -1, -1, -1]

// why: how many chunks of unspent mouse movement are worth keeping after a fast flick
const LOOK_BACKLOG_CHUNKS = 2

export type LookDelta = { dxPx: number; dyPx: number }

export type InputStore = {
  press: (action: HoldAction) => void
  release: (action: HoldAction) => void
  jump: () => void
  pressEvent: (key: string) => void
  releaseEvent: (key: string) => void
  accumulateLook: (delta: LookDelta) => void
  // why: a lost keyup would otherwise leave the world moving forever
  clear: () => void
  intent: (rotationSpeedDeg: number) => ControlIntent
  sceneInput: () => SceneInputState
  // note: consumed exactly when the pose that carries it is built
  // note: a cap spends only what one chunk can rotate and keeps the rest for the next one
  consumeLook: (cap?: LookDelta) => LookDelta
  hasLook: () => boolean
  consumeCrouchDip: () => 'down' | 'up' | null
  jumpLatents: (count: number) => number[]
  advanceJump: (latents: number) => void
  isJumping: () => boolean
  heldEventKeys: () => string[]
}

// fn: the reader's held keys, resolved the way players expect
export function createInputStore(): InputStore {
  const longitudinal: Longitudinal[] = []
  const lateral: Lateral[] = []
  const lookHorizontal: LookHorizontal[] = []
  const lookVertical: LookVertical[] = []
  let heldEvents: string[] = []
  let crouching = false
  let crouchDip: 'down' | 'up' | null = null
  let jumpPosition = 0
  let jumping = false
  let look: LookDelta = { dxPx: 0, dyPx: 0 }

  // why: top of stack wins, so pressing W then S then releasing S resumes forward
  const push = <T>(stack: T[], value: T) => {
    if (!stack.includes(value)) stack.push(value)
  }
  const drop = <T>(stack: T[], value: T) => {
    const index = stack.indexOf(value)
    if (index >= 0) stack.splice(index, 1)
  }

  const hold = <T>(stack: T[], value: T) => ({
    on: () => push(stack, value),
    off: () => drop(stack, value),
  })

  const HOLDS: Record<Exclude<HoldAction, 'crouch'>, { on: () => void; off: () => void }> = {
    forward: hold(longitudinal, 'forward'),
    back: hold(longitudinal, 'back'),
    'strafe-left': hold(lateral, 'strafe_left'),
    'strafe-right': hold(lateral, 'strafe_right'),
    'turn-left': hold(lookHorizontal, 'left'),
    'turn-right': hold(lookHorizontal, 'right'),
    'look-up': hold(lookVertical, 'up'),
    'look-down': hold(lookVertical, 'down'),
  }

  return {
    press: (action) => {
      if (action === 'crouch') {
        // note: the dip fires on the idle-to-held edge only, so key repeat cannot spam motion
        if (!crouching) {
          crouching = true
          crouchDip = 'down'
        }
        return
      }
      HOLDS[action].on()
    },
    release: (action) => {
      if (action === 'crouch') {
        if (crouching) {
          crouching = false
          crouchDip = 'up'
        }
        return
      }
      HOLDS[action].off()
    },
    // note: no double jump — an arc in flight owns the vertical channel until it lands
    jump: () => {
      if (jumping) return
      jumping = true
      jumpPosition = 0
    },
    pressEvent: (key) => {
      if (!heldEvents.includes(key)) heldEvents = [...heldEvents, key]
    },
    releaseEvent: (key) => {
      heldEvents = heldEvents.filter((held) => held !== key)
    },
    accumulateLook: ({ dxPx, dyPx }) => {
      look = { dxPx: look.dxPx + dxPx, dyPx: look.dyPx + dyPx }
    },
    clear: () => {
      longitudinal.length = 0
      lateral.length = 0
      lookHorizontal.length = 0
      lookVertical.length = 0
      heldEvents = []
      crouching = false
      crouchDip = null
      jumping = false
      jumpPosition = 0
      look = { dxPx: 0, dyPx: 0 }
    },
    intent: (rotationSpeedDeg) => ({
      longitudinal: longitudinal.at(-1) ?? 'idle',
      lateral: lateral.at(-1) ?? 'idle',
      lookHorizontal: lookHorizontal.at(-1) ?? 'idle',
      lookVertical: lookVertical.at(-1) ?? 'idle',
      rotationSpeedDeg,
    }),
    sceneInput: () => ({
      moving: longitudinal.length > 0 || lateral.length > 0,
      heldEventKeys: heldEvents,
      vertical: jumping ? 'jump' : crouching ? 'crouch' : 'stand',
    }),
    hasLook: () => look.dxPx !== 0 || look.dyPx !== 0,
    consumeLook: (cap) => {
      if (!cap) {
        const all = look
        look = { dxPx: 0, dyPx: 0 }
        return all
      }
      // why: clipping a fling and discarding the rest is what makes looking feel unresponsive
      const spend = (value: number, limit: number) =>
        Math.sign(value) * Math.min(Math.abs(value), Math.abs(limit))
      const consumed = { dxPx: spend(look.dxPx, cap.dxPx), dyPx: spend(look.dyPx, cap.dyPx) }
      // why: a fling should turn further than one chunk, but never keep turning for seconds
      const keep = (value: number, limit: number) => spend(value, limit * LOOK_BACKLOG_CHUNKS)
      look = {
        dxPx: keep(look.dxPx - consumed.dxPx, cap.dxPx),
        dyPx: keep(look.dyPx - consumed.dyPx, cap.dyPx),
      }
      return consumed
    },
    consumeCrouchDip: () => {
      const dip = crouchDip
      crouchDip = null
      return dip
    },
    jumpLatents: (count) => {
      if (!jumping) return new Array<number>(count).fill(0)
      return Array.from({ length: count }, (_, index) => JUMP_ARC[jumpPosition + index] ?? 0)
    },
    advanceJump: (latents) => {
      if (!jumping) return
      jumpPosition += latents
      if (jumpPosition >= JUMP_ARC.length) {
        jumping = false
        jumpPosition = 0
      }
    },
    isJumping: () => jumping,
    heldEventKeys: () => heldEvents,
  }
}
