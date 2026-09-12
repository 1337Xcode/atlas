import type { WorldCapabilities, WorldControlSettings } from '@atlas/schema'
import { createEventHolds } from './holds.ts'
import type { HoldAction, InputStore } from './input.ts'
import type { Unsubscribe } from './transport.ts'

// feat: phone controls, a move pad under the left thumb and a look pad under the right

export type BindTouchControlsOptions = {
  // note: drag from its centre to walk, like a stick
  movePad: HTMLElement
  // note: drag anywhere on it to look
  lookPad: HTMLElement
  // note: optional bar of buttons, each declaring `data-action`
  buttonBar?: HTMLElement | undefined
  input: InputStore
  settings: WorldControlSettings
  capabilities: WorldCapabilities
  eventKeys: readonly string[]
  onChange: () => void
  onActivity?: () => void
}

// why: a thumb never rests exactly still, so small movement is not movement
const STICK_DEADZONE_PX = 16

// why: a thumb travels far less than a mouse, so the same rotation needs more per pixel
const TOUCH_LOOK_SCALE = 2.5

export function bindTouchControls(options: BindTouchControlsOptions): Unsubscribe {
  const { movePad, lookPad, input, settings, capabilities, eventKeys, onChange } = options
  const onActivity = options.onActivity ?? (() => undefined)
  const holds = createEventHolds({ input, eventKeys, maxHoldMs: settings.maxHoldMs, onChange })

  // why: without a lateral axis, sideways on the stick turns instead of strafing
  const sideways: [HoldAction, HoldAction] =
    settings.strafeMode === 'lateral' && capabilities.move.lateral
      ? ['strafe-left', 'strafe-right']
      : ['turn-left', 'turn-right']

  let origin: { x: number; y: number } | undefined
  let pressed: HoldAction[] = []
  let looking: { x: number; y: number } | undefined

  // fn: press and release only what changed, so a moving thumb does not spam the wire
  const applyStick = (next: HoldAction[]) => {
    const gone = pressed.filter((action) => !next.includes(action))
    const fresh = next.filter((action) => !pressed.includes(action))
    if (gone.length === 0 && fresh.length === 0) return

    for (const action of gone) input.release(action)
    for (const action of fresh) input.press(action)
    pressed = next
    onChange()
  }

  const stickActions = (dx: number, dy: number): HoldAction[] => {
    const actions: HoldAction[] = []
    if (Math.abs(dy) > STICK_DEADZONE_PX) actions.push(dy < 0 ? 'forward' : 'back')
    if (Math.abs(dx) > STICK_DEADZONE_PX) actions.push(dx < 0 ? sideways[0] : sideways[1])
    return actions
  }

  const onMoveStart = (event: PointerEvent) => {
    event.preventDefault()
    origin = { x: event.clientX, y: event.clientY }
    capture(movePad, event.pointerId)
    onActivity()
  }

  const onMoveDrag = (event: PointerEvent) => {
    if (!origin) return
    event.preventDefault()
    applyStick(stickActions(event.clientX - origin.x, event.clientY - origin.y))
    onActivity()
  }

  const onMoveEnd = () => {
    origin = undefined
    applyStick([])
  }

  const onLookStart = (event: PointerEvent) => {
    event.preventDefault()
    looking = { x: event.clientX, y: event.clientY }
    capture(lookPad, event.pointerId)
    onActivity()
  }

  // perf: deltas accumulate into the same channel the mouse uses, one pose per chunk
  const onLookDrag = (event: PointerEvent) => {
    if (!looking) return
    event.preventDefault()
    input.accumulateLook({
      dxPx: (event.clientX - looking.x) * TOUCH_LOOK_SCALE,
      dyPx: (event.clientY - looking.y) * TOUCH_LOOK_SCALE,
    })
    looking = { x: event.clientX, y: event.clientY }
    onActivity()
  }

  const onLookEnd = () => {
    looking = undefined
  }

  // note: buttons declare themselves in markup, so react can re-render them freely
  const actionOf = (target: EventTarget | null): string | undefined =>
    target instanceof HTMLElement
      ? (target.closest('[data-action]')?.getAttribute('data-action') ?? undefined)
      : undefined

  const onButtonDown = (event: PointerEvent) => {
    const action = actionOf(event.target)
    if (!action) return
    event.preventDefault()
    onActivity()

    if (action === 'jump') {
      if (capabilities.vertical) input.jump()
      onChange()
      return
    }
    if (action === 'crouch') {
      if (capabilities.vertical) input.press('crouch')
      onChange()
      return
    }
    if (action.startsWith('event:') && holds.press(action.slice(6))) onChange()
  }

  const onButtonUp = (event: PointerEvent) => {
    const action = actionOf(event.target)
    if (!action) return

    if (action === 'crouch') {
      if (capabilities.vertical) input.release('crouch')
      onChange()
      return
    }
    if (action.startsWith('event:') && holds.release(action.slice(6))) onChange()
  }

  const listeners: [HTMLElement, string, (event: PointerEvent) => void][] = [
    [movePad, 'pointerdown', onMoveStart],
    [movePad, 'pointermove', onMoveDrag],
    [movePad, 'pointerup', onMoveEnd],
    [movePad, 'pointercancel', onMoveEnd],
    [lookPad, 'pointerdown', onLookStart],
    [lookPad, 'pointermove', onLookDrag],
    [lookPad, 'pointerup', onLookEnd],
    [lookPad, 'pointercancel', onLookEnd],
    ...(options.buttonBar
      ? ([
          [options.buttonBar, 'pointerdown', onButtonDown],
          [options.buttonBar, 'pointerup', onButtonUp],
          [options.buttonBar, 'pointercancel', onButtonUp],
        ] as [HTMLElement, string, (event: PointerEvent) => void][])
      : []),
  ]

  for (const [element, type, handler] of listeners) {
    element.addEventListener(type, handler as EventListener)
  }

  return () => {
    for (const [element, type, handler] of listeners) {
      element.removeEventListener(type, handler as EventListener)
    }
    holds.releaseAll()
    applyStick([])
    looking = undefined
    input.clear()
    onChange()
  }
}

// note: capture keeps a drag alive when the thumb slides off the pad
function capture(element: HTMLElement, pointerId: number) {
  if (typeof element.setPointerCapture !== 'function') return
  try {
    element.setPointerCapture(pointerId)
  } catch {
    // note: harmless, the drag still works without capture
  }
}
