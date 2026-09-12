import type { WorldCapabilities, WorldControlSettings } from '@atlas/schema'
import { createEventHolds } from './holds.ts'
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

// note: one slot per physical control; which axis `left`/`right` drive depends on the model
type Slot =
  | 'forward'
  | 'back'
  | 'left'
  | 'right'
  | 'turn-left'
  | 'turn-right'
  | 'look-up'
  | 'look-down'
  | 'crouch'
  | 'jump'
  | `event:${string}`

const EVENT_SLOTS = (prefix: string): Record<string, Slot> =>
  Object.fromEntries(
    Array.from({ length: 9 }, (_, index) => [
      `${prefix}${index + 1}`,
      `event:${index + 1}` as Slot,
    ]),
  )

// why: `event.code` is layout independent, so WASD works on qwerty, azerty and dvorak alike
const CODE_SLOTS: Record<string, Slot> = {
  KeyW: 'forward',
  KeyS: 'back',
  KeyA: 'left',
  KeyD: 'right',
  KeyC: 'crouch',
  Space: 'jump',
  ArrowLeft: 'turn-left',
  ArrowRight: 'turn-right',
  ArrowUp: 'look-up',
  ArrowDown: 'look-down',
  ...EVENT_SLOTS('Digit'),
  ...EVENT_SLOTS('Numpad'),
}

// fix: remote desktops, virtual keyboards and some IMEs deliver a keydown with no `code` at all.
// why: reading only `event.code` there leaves every control dead, which is indistinguishable
// why: from a broken world, so `event.key` is the documented fallback for exactly that case
const KEY_SLOTS: Record<string, Slot> = {
  w: 'forward',
  s: 'back',
  a: 'left',
  d: 'right',
  c: 'crouch',
  ' ': 'jump',
  spacebar: 'jump',
  arrowleft: 'turn-left',
  arrowright: 'turn-right',
  arrowup: 'look-up',
  arrowdown: 'look-down',
  ...EVENT_SLOTS(''),
}

function slotFor(event: KeyboardEvent): Slot | undefined {
  return CODE_SLOTS[event.code] ?? KEY_SLOTS[event.key?.toLowerCase() ?? '']
}

export function bindControls(options: BindControlsOptions): Unsubscribe {
  const { surface, input, settings, capabilities, eventKeys, onChange } = options
  const onActivity = options.onActivity ?? (() => undefined)
  const holds = createEventHolds({ input, eventKeys, maxHoldMs: settings.maxHoldMs, onChange })

  // why: keys are listened for on the window, because macos browsers do not focus a div on click
  // why: so an explicit active flag decides whether this world owns the keyboard
  // fix: a browser whose window is not system-focused defers the focus event but still moves
  // fix: activeElement, so the world reads the focus it already holds rather than waiting for it
  let active = document.activeElement !== null && surface.contains(document.activeElement)
  let dragging = false
  let lookTimer: ReturnType<typeof setTimeout> | undefined
  const onFocus = () => {
    active = true
  }
  // perf: merge pointer bursts without clearing a pose already sent by the chunk clock
  const queueLook = () => {
    if (lookTimer !== undefined) return
    lookTimer = setTimeout(
      () => {
        lookTimer = undefined
        if (input.hasLook()) onChange()
      },
      Math.min(100, capabilities.chunkMs),
    )
  }

  // why: strafing is the least stable axis, so a model without one turns instead
  const strafes = settings.strafeMode === 'lateral' && capabilities.move.lateral
  const HOLDS: Partial<Record<Slot, HoldAction>> = {
    forward: 'forward',
    back: 'back',
    left: strafes ? 'strafe-left' : 'turn-left',
    right: strafes ? 'strafe-right' : 'turn-right',
    'turn-left': 'turn-left',
    'turn-right': 'turn-right',
    'look-up': 'look-up',
    'look-down': 'look-down',
    crouch: 'crouch',
  }

  const holdFor = (slot: Slot): HoldAction | undefined => {
    const action = HOLDS[slot]
    if (action === 'crouch' && !capabilities.vertical) return undefined
    return action
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (!active || isTyping(event.target)) return
    // note: holding a key re-sends nothing, the wire already holds that state
    if (event.repeat) return
    const slot = slotFor(event)
    if (slot === undefined) return
    // why: a focused button still has to answer space and enter, but it must not eat walking
    if (slot === 'jump' && activates(event.target)) return
    event.preventDefault()
    onActivity()

    const hold = holdFor(slot)
    if (hold) {
      input.press(hold)
      onChange()
      return
    }

    if (slot === 'jump') {
      if (!capabilities.vertical) return
      input.jump()
      onChange()
      return
    }

    if (holds.press(slot.slice('event:'.length))) onChange()
  }

  const onKeyUp = (event: KeyboardEvent) => {
    if (!active) return
    const slot = slotFor(event)
    if (slot === undefined) return
    if (slot === 'jump' && activates(event.target)) return
    event.preventDefault()

    const hold = holdFor(slot)
    if (hold) {
      input.release(hold)
      onChange()
      return
    }

    if (slot !== 'jump' && holds.release(slot.slice('event:'.length))) onChange()
  }

  // note: clicking the world takes the keyboard and asks for the mouse; clicking away gives both back
  const onPointerDown = (event: Event) => {
    const inside = event.target instanceof Node && surface.contains(event.target)
    if (!inside) {
      if (active) sweep()
      active = false
      return
    }

    if (isTyping(event.target) || ('pointerType' in event && event.pointerType === 'touch')) return
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

  // why: pointer lock is often refused, so looking must also work from plain mouse movement
  const shouldLook = (event: MouseEvent): boolean => {
    if (document.pointerLockElement === surface) return true
    if (!active) return false
    // note: over the world, or dragging from it, so the buttons underneath stay usable
    if (dragging) return true
    return event.target instanceof Node && surface.contains(event.target)
  }

  // perf: deltas accumulate here and convert to one rotation per chunk, never a command per move
  const onMouseMove = (event: MouseEvent) => {
    if (!shouldLook(event)) return
    if (event.movementX === 0 && event.movementY === 0) return
    input.accumulateLook({ dxPx: event.movementX, dyPx: event.movementY })
    onActivity()
    queueLook()
  }

  // feat: two-finger trackpad gestures steer the view rather than scroll the world page
  const onWheel = (event: WheelEvent) => {
    if (!active || event.ctrlKey || isTyping(event.target)) return
    event.preventDefault()
    const scale = event.deltaMode === 1 ? 16 : 1
    input.accumulateLook({ dxPx: event.deltaX * scale, dyPx: event.deltaY * scale })
    onActivity()
    queueLook()
  }

  // why: a keyup lost to a blur or a tab switch would leave the world walking forever
  const sweep = () => {
    clearTimeout(lookTimer)
    lookTimer = undefined
    holds.releaseAll()
    dragging = false
    input.clear()
    onChange()
  }

  const onWindowBlur = () => {
    sweep()
  }

  // note: focusin rather than focus, so focus landing on anything inside the world counts too
  surface.addEventListener('focusin', onFocus)
  surface.addEventListener('wheel', onWheel, { passive: false })
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('pointerdown', onPointerDown, true)
  window.addEventListener('pointerup', onPointerUp, true)
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('blur', onWindowBlur)

  return () => {
    surface.removeEventListener('focusin', onFocus)
    surface.removeEventListener('wheel', onWheel)
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

// why: only a real text field should swallow a movement key; a button must not
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return ['input', 'textarea', 'select'].includes(target.tagName.toLowerCase())
}

// note: the controls the world chrome itself uses, which space and enter belong to
function activates(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return ['button', 'a', 'summary'].includes(target.tagName.toLowerCase())
}
