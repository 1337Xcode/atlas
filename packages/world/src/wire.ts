import type { ControlIntent, WorldCapabilities } from '@atlas/schema'

// docs: https://docs.reactor.inc/concepts/commands-and-messages

export type Command = { name: string; data: Record<string, unknown> }

// note: structural stand-in for the sdk's FileRef, so this package stays sdk-free
export type FileRefLike = {
  uploadId: string
  name: string
  mimeType: string
  size: number
}

export type KvCacheResetMode = 'auto' | 'manual' | 'off'
export type AttentionWindow = 'auto' | 'small' | 'large'
export type LifecycleAction = 'start' | 'pause' | 'resume' | 'reset'

// note: one vocabulary per model; the diffing below is shared
export type WorldModelCommands = {
  setPrompt: (prompt: string) => Command
  setImage: (image: FileRefLike) => Command
  setSeed: (seed: number) => Command
  setRotationSpeed: (deg: number) => Command
  lifecycle: (action: LifecycleAction) => Command
  move: (prev: ControlIntent, next: ControlIntent) => Command[]
  look: (prev: ControlIntent, next: ControlIntent) => Command[]
  setCameraPose?: (pose: readonly number[]) => Command
  setKvCacheReset?: (mode: KvCacheResetMode) => Command
  triggerKvCacheReset?: () => Command
  setAttnWindow?: (window: AttentionWindow) => Command
}

export type WorldModelDescriptor = {
  id: string
  // note: the connect slug handed to the sdk, e.g. reactor/lingbot-world-2
  slug: string
  capabilities: WorldCapabilities
  commands: WorldModelCommands
}

// note: everything the model should currently believe about our inputs
export type WireState = {
  intent: ControlIntent
  // note: per-latent camera deltas while a look or vertical control is engaged, else null
  pose: readonly number[] | null
  prompt: string
}

// fn: reduce a desired wire state to the fewest commands that move the model to it
export function planCommands(
  model: WorldModelDescriptor,
  prev: WireState,
  next: WireState,
): Command[] {
  const { commands, capabilities } = model
  const plan: Command[] = []

  // why: set_prompt mid-generation is cheap and lands on the next chunk, so only resend on change
  if (next.prompt !== prev.prompt && next.prompt.length > 0) {
    plan.push(commands.setPrompt(next.prompt))
  }

  plan.push(...commands.move(prev.intent, next.intent))

  if (capabilities.look.mode === 'axes') {
    plan.push(...commands.look(prev.intent, next.intent))
    if (next.intent.rotationSpeedDeg !== prev.intent.rotationSpeedDeg) {
      plan.push(commands.setRotationSpeed(next.intent.rotationSpeedDeg))
    }
  }

  plan.push(...planPose(commands, prev.pose, next.pose))
  return plan
}

// why: a pose is a per-chunk motion profile, so it is re-sent while active and cleared once
function planPose(
  commands: WorldModelCommands,
  prev: readonly number[] | null,
  next: readonly number[] | null,
): Command[] {
  const setCameraPose = commands.setCameraPose
  if (!setCameraPose) return []
  if (next) return [setCameraPose(next)]
  return prev ? [setCameraPose([])] : []
}

// fn: the commands that stage a fresh session before start
export function stagingCommands(
  model: WorldModelDescriptor,
  input: { image: FileRefLike; prompt: string; seed: number; rotationSpeedDeg: number },
): { image: Command; prompt: Command; settings: Command[] } {
  const { commands, capabilities } = model
  const settings: Command[] = [commands.setSeed(input.seed)]

  if (capabilities.look.mode === 'axes') {
    settings.push(commands.setRotationSpeed(input.rotationSpeedDeg))
  }
  // why: periodic kv-cache resets keep long sessions in-distribution instead of drifting
  if (commands.setKvCacheReset) settings.push(commands.setKvCacheReset('auto'))
  // note: auto tracks motion; forcing a window is reserved for scenes the model reads wrong
  if (commands.setAttnWindow) settings.push(commands.setAttnWindow('auto'))

  return {
    image: commands.setImage(input.image),
    prompt: commands.setPrompt(input.prompt),
    settings,
  }
}
