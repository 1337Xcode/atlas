import type { WorldCapabilities, WorldControlSettings } from '@atlas/schema'
import type { HoldAction, InputStore } from './input.ts'
import type { Unsubscribe } from './transport.ts'

// feat: first-person controls, WASD to walk, mouse to look, number keys for sourced events

export type BindControlsOptions = {
  surface: HTMLElement
  input: InputStore
  settings: WorldControlSettings
  capabilities: WorldCapabilities
  // note: hold keys the scene actually declares, so an unbound number key does nothing
  eventKeys: readonly string[]
  // note: called when the wire state changed and should be flushed now
  onChange: () => void
  // note: called on any input at all, including mouse movement, to keep the idle timer honest
  onActivity?: () => void
}

// why: `event.code` is layout independent, so WASD works on qwerty, azerty and dvorak alike
const HOLD_CODES: Record<string, HoldAction> = {
  KeyW: 'forward',
  KeyS: 'back',
  ArrowLeft: 'turn-left',
  ArrowRight: 'turn-right',
  ArrowUp: 'look-up',
  ArrowDown: 'look-down',
  KeyC: 'crouch',
}

const EVENT_CODES = [
  'Digit1',
  'Digit2',
  'Digit3',
  'Digit4',
  'Digit5',
  'Digit6',
  'Digit7',
  'Digit8',
  'Digit9',
]

// why: the page must not scroll or fire browser shortcuts while the reader is walking
const SWALLOWED = new Set([
  'Space',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  ...Object.keys(HOLD_CODES),
  ...EVENT_CODES,
])

export function bindControls(options: BindControlsOptions): Unsubscribe {
  const { surface, input, settings, capabilities, eventKeys, onChange } = options
  const onActivity = options.onActivity ?? (() => undefined)
  const holdTimers = new Map<string, ReturnType<typeof setTimeout>>()

  // why: keys are listened for on the window, because macos browsers do not focus a div on click
  // why: so an explicit active flag decides whether this world owns the keyboard
  let active = false
  let dragging = false

  // why: strafing is the least stable axis, so a model without one turns instead
  const lateral: Record<string, HoldAction> =
    settings.strafeMode === 'lateral' && capabilities.move.lateral
      ? { KeyA: 'strafe-left', KeyD: 'strafe-right' }
      : { KeyA: 'turn-left', KeyD: 'turn-right' }

  const holdFor = (code: string): HoldAction | undefined => {
    const action = lateral[code] ?? HOLD_CODES[code]
    if (action === 'crouch' && !capabilities.vertical) return undefined
    return action
  }

  const eventKeyFor = (code: string): string | undefined => {
    if (!EVENT_CODES.includes(code)) return undefined
    const key = code.replace('Digit', '')
    return eventKeys.includes(key) ? key : undefined
  }

  const releaseEvent = (key: string) => {
    clearTimeout(holdTimers.get(key))
    holdTimers.delete(key)
    input.releaseEvent(key)
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (!active || isTyping(event.target)) return
    // note: holding a key re-sends nothing, the wire already holds that state
    if (event.repeat) return
    if (SWALLOWED.has(event.code)) event.preventDefault()
    onActivity()

    const hold = holdFor(event.code)
    if (hold) {
      input.press(hold)
      onChange()
      return
    }

    if (event.code === 'Space' && capabilities.vertical) {
      input.jump()
      onChange()
      return
    }

    const eventKey = eventKeyFor(event.code)
    if (eventKey) {
      input.pressEvent(eventKey)
      // why: long continuous holds accumulate drift, so a hold releases itself and settles
      holdTimers.set(
        eventKey,
        setTimeout(() => {
          releaseEvent(eventKey)
          onChange()
        }, settings.maxHoldMs),
      )
      onChange()
    }
  }

  const onKeyUp = (event: KeyboardEvent) => {
    if (!active || isTyping(event.target)) return
    if (SWALLOWED.has(event.code)) event.preventDefault()

    const hold = holdFor(event.code)
    if (hold) {
      input.release(hold)
      onChange()
      return
    }

    const eventKey = eventKeyFor(event.code)
    if (eventKey) {
      releaseEvent(eventKey)
      onChange()
    }
  }

  // note: clicking the world takes the keyboard and asks for the mouse; clicking away gives both back
  const onPointerDown = (event: Event) => {
    const inside = event.target instanceof Node && surface.contains(event.target)
    if (!inside) {
      if (active) sweep()
      active = false
      return
    }

    active = true
    dragging = true
    onActivity()
    // note: focus is best effort, since the window listeners do not depend on it
    surface.focus({ preventScroll: true })
    lockPointer()
  }

  // why: pointer lock is an enhancement; it can be missing, refused or thrown, and dragging covers all three
  const lockPointer = () => {
    if (document.pointerLockElement === surface) return
    if (typeof surface.requestPointerLock !== 'function') return
    void Promise.resolve()
      .then(() => surface.requestPointerLock())
      .catch(() => undefined)
  }

  const onPointerUp = () => {
    dragging = false
  }

  // perf: deltas accumulate here and convert to one rotation per chunk, never a command per move
  const onMouseMove = (event: MouseEvent) => {
    const locked = document.pointerLockElement === surface
    if (!locked && !(dragging && active)) return
    if (event.movementX === 0 && event.movementY === 0) return
    input.accumulateLook({ dxPx: event.movementX, dyPx: event.movementY })
    onActivity()
  }

  // why: a keyup lost to a blur or a tab switch would leave the world walking forever
  const sweep = () => {
    for (const timer of holdTimers.values()) clearTimeout(timer)
    holdTimers.clear()
    dragging = false
    input.clear()
    onChange()
  }

  const onWindowBlur = () => {
    sweep()
  }

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('pointerdown', onPointerDown, true)
  window.addEventListener('pointerup', onPointerUp, true)
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('blur', onWindowBlur)

  return () => {
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
    window.removeEventListener('pointerdown', onPointerDown, true)
    window.removeEventListener('pointerup', onPointerUp, true)
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('blur', onWindowBlur)
    if (document.pointerLockElement === surface) document.exitPointerLock?.()
    active = false
    sweep()
  }
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return ['input', 'textarea', 'select', 'button'].includes(target.tagName.toLowerCase())
}
