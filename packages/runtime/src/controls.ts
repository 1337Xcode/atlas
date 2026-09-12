import type { WorldCapabilities, WorldControlSettings } from '@atlas/schema'
import type { HoldAction, InputStore } from './input.ts'
import type { Unsubscribe } from './transport.ts'

// feat: first-person controls — WASD to walk, mouse to look, number keys for sourced events

export type BindControlsOptions = {
  surface: HTMLElement
  input: InputStore
  settings: WorldControlSettings
  capabilities: WorldCapabilities
  // note: hold keys the scene actually declares, so an unbound number key does nothing
  eventKeys: readonly string[]
  onChange: () => void
}

const HOLD_KEYS: Record<string, HoldAction> = {
  w: 'forward',
  s: 'back',
  arrowleft: 'turn-left',
  arrowright: 'turn-right',
  arrowup: 'look-up',
  arrowdown: 'look-down',
  c: 'crouch',
}

// fn: wire a dom surface to the input store, and keep every press balanced by a release
export function bindControls(options: BindControlsOptions): Unsubscribe {
  const { surface, input, settings, capabilities, eventKeys, onChange } = options
  const holdTimers = new Map<string, ReturnType<typeof setTimeout>>()

  // why: strafing is the least stable axis, so a model without one turns instead
  const lateral: Record<string, HoldAction> =
    settings.strafeMode === 'lateral' && capabilities.move.lateral
      ? { a: 'strafe-left', d: 'strafe-right' }
      : { a: 'turn-left', d: 'turn-right' }

  const holdFor = (key: string): HoldAction | undefined => {
    const action = lateral[key] ?? HOLD_KEYS[key]
    if (action === 'crouch' && !capabilities.vertical) return undefined
    return action
  }

  const releaseEvent = (key: string) => {
    clearTimeout(holdTimers.get(key))
    holdTimers.delete(key)
    input.releaseEvent(key)
  }

  const onKeyDown = (raw: Event) => {
    const event = raw as KeyboardEvent
    // note: holding a key re-sends nothing, the wire already has that state
    if (event.repeat || isTyping(event.target)) return
    const key = event.key.toLowerCase()

    const hold = holdFor(key)
    if (hold) {
      event.preventDefault()
      input.press(hold)
      onChange()
      return
    }

    if (key === ' ' && capabilities.vertical) {
      event.preventDefault()
      input.jump()
      onChange()
      return
    }

    if (eventKeys.includes(key)) {
      event.preventDefault()
      input.pressEvent(key)
      // why: long continuous holds accumulate drift, so a hold releases itself and settles
      holdTimers.set(
        key,
        setTimeout(() => {
          releaseEvent(key)
          onChange()
        }, settings.maxHoldMs),
      )
      onChange()
    }
  }

  const onKeyUp = (raw: Event) => {
    const event = raw as KeyboardEvent
    if (isTyping(event.target)) return
    const key = event.key.toLowerCase()

    const hold = holdFor(key)
    if (hold) {
      input.release(hold)
      onChange()
      return
    }
    if (eventKeys.includes(key)) {
      releaseEvent(key)
      onChange()
    }
  }

  // note: pointer lock is what makes mouse-look feel like a game rather than a drag
  const onPointerDown = () => {
    if (document.pointerLockElement !== surface) void surface.requestPointerLock()
  }

  // perf: deltas accumulate here and convert to one rotation per chunk, no command per mousemove
  const onMouseMove = (raw: Event) => {
    if (document.pointerLockElement !== surface) return
    const event = raw as MouseEvent
    input.accumulateLook({ dxPx: event.movementX, dyPx: event.movementY })
  }

  // why: a keyup lost to a blur or a tab switch would leave the world walking forever
  const sweep = () => {
    for (const key of holdTimers.keys()) clearTimeout(holdTimers.get(key))
    holdTimers.clear()
    input.clear()
    onChange()
  }

  surface.addEventListener('keydown', onKeyDown)
  surface.addEventListener('keyup', onKeyUp)
  surface.addEventListener('pointerdown', onPointerDown)
  surface.addEventListener('mousemove', onMouseMove)
  surface.addEventListener('blur', sweep)
  window.addEventListener('blur', sweep)

  return () => {
    surface.removeEventListener('keydown', onKeyDown)
    surface.removeEventListener('keyup', onKeyUp)
    surface.removeEventListener('pointerdown', onPointerDown)
    surface.removeEventListener('mousemove', onMouseMove)
    surface.removeEventListener('blur', sweep)
    window.removeEventListener('blur', sweep)
    sweep()
  }
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return ['input', 'textarea', 'select'].includes(target.tagName.toLowerCase())
}
