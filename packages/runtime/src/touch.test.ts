import { DEFAULT_CONTROL_SETTINGS, LINGBOT, LINGBOT_WORLD_2 } from '@atlas/world'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createInputStore, type InputStore } from './input.ts'
import { bindTouchControls } from './touch.ts'

let input: InputStore
let movePad: HTMLElement
let lookPad: HTMLElement
let buttonBar: HTMLElement
let unbind: () => void
let changes: number

function bind(capabilities = LINGBOT_WORLD_2.capabilities) {
  unbind = bindTouchControls({
    movePad,
    lookPad,
    buttonBar,
    input,
    settings: capabilities.move.lateral
      ? DEFAULT_CONTROL_SETTINGS
      : { ...DEFAULT_CONTROL_SETTINGS, strafeMode: 'turn' },
    capabilities,
    eventKeys: ['1'],
    onChange: () => {
      changes += 1
    },
  })
}

// note: jsdom has no PointerEvent, so a mouse event carrying a pointerId is close enough
function touch(element: HTMLElement, type: string, x: number, y: number) {
  const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y })
  Object.defineProperty(event, 'pointerId', { value: 1 })
  element.dispatchEvent(event)
}

function button(action: string, type: 'pointerdown' | 'pointerup') {
  const target = buttonBar.querySelector(`[data-action="${action}"]`)
  target?.dispatchEvent(new MouseEvent(type, { bubbles: true }))
}

beforeEach(() => {
  vi.useFakeTimers()
  input = createInputStore()
  movePad = document.createElement('div')
  lookPad = document.createElement('div')
  buttonBar = document.createElement('div')
  buttonBar.innerHTML =
    '<button data-action="jump"></button><button data-action="crouch"></button>' +
    '<button data-action="event:1"></button><button data-action="event:9"></button>'
  document.body.append(movePad, lookPad, buttonBar)
  changes = 0
})

afterEach(() => {
  unbind()
  movePad.remove()
  lookPad.remove()
  buttonBar.remove()
  vi.useRealTimers()
})

describe('bindTouchControls', () => {
  it('walks forward when the thumb pushes up the move pad', () => {
    bind()
    touch(movePad, 'pointerdown', 100, 100)
    touch(movePad, 'pointermove', 100, 60)
    expect(input.intent(5).longitudinal).toBe('forward')
  })

  it('walks back and strafes on a diagonal drag', () => {
    bind()
    touch(movePad, 'pointerdown', 100, 100)
    touch(movePad, 'pointermove', 140, 140)
    expect(input.intent(5)).toMatchObject({ longitudinal: 'back', lateral: 'strafe_right' })
  })

  it('ignores a thumb that barely moves', () => {
    bind()
    touch(movePad, 'pointerdown', 100, 100)
    touch(movePad, 'pointermove', 108, 105)
    expect(input.intent(5)).toMatchObject({ longitudinal: 'idle', lateral: 'idle' })
  })

  it('turns instead of strafing when the model has no lateral axis', () => {
    bind(LINGBOT.capabilities)
    touch(movePad, 'pointerdown', 100, 100)
    touch(movePad, 'pointermove', 60, 100)
    expect(input.intent(5)).toMatchObject({ lateral: 'idle', lookHorizontal: 'left' })
  })

  it('stops walking the moment the thumb lifts', () => {
    bind()
    touch(movePad, 'pointerdown', 100, 100)
    touch(movePad, 'pointermove', 100, 40)
    touch(movePad, 'pointerup', 100, 40)
    expect(input.intent(5).longitudinal).toBe('idle')
  })

  it('sends nothing while the thumb slides within the same direction', () => {
    bind()
    touch(movePad, 'pointerdown', 100, 100)
    touch(movePad, 'pointermove', 100, 60)
    const afterFirst = changes
    touch(movePad, 'pointermove', 100, 50)
    touch(movePad, 'pointermove', 100, 40)
    expect(changes).toBe(afterFirst)
  })

  it('looks around from a drag on the look pad', () => {
    bind()
    touch(lookPad, 'pointerdown', 200, 200)
    touch(lookPad, 'pointermove', 210, 195)
    const look = input.consumeLook()
    expect(look.dxPx).toBeGreaterThan(0)
    expect(look.dyPx).toBeLessThan(0)
  })

  it('measures each look drag from the last point, not the first', () => {
    bind()
    touch(lookPad, 'pointerdown', 200, 200)
    touch(lookPad, 'pointermove', 210, 200)
    touch(lookPad, 'pointermove', 220, 200)
    expect(input.consumeLook().dxPx).toBe(50)
  })

  it('stops looking when the thumb lifts', () => {
    bind()
    touch(lookPad, 'pointerdown', 200, 200)
    touch(lookPad, 'pointerup', 200, 200)
    input.consumeLook()
    touch(lookPad, 'pointermove', 260, 200)
    expect(input.consumeLook()).toEqual({ dxPx: 0, dyPx: 0 })
  })

  it('jumps and crouches from the button bar', () => {
    bind()
    button('jump', 'pointerdown')
    expect(input.isJumping()).toBe(true)

    button('crouch', 'pointerdown')
    expect(input.consumeCrouchDip()).toBe('down')
    button('crouch', 'pointerup')
    expect(input.consumeCrouchDip()).toBe('up')
  })

  it('holds a scene event from the button bar', () => {
    bind()
    button('event:1', 'pointerdown')
    expect(input.heldEventKeys()).toEqual(['1'])
    button('event:1', 'pointerup')
    expect(input.heldEventKeys()).toEqual([])
  })

  it('ignores a button for a key the scene does not declare', () => {
    bind()
    button('event:9', 'pointerdown')
    expect(input.heldEventKeys()).toEqual([])
  })

  it('releases a held event by itself, exactly like the keyboard', () => {
    bind()
    button('event:1', 'pointerdown')
    vi.advanceTimersByTime(DEFAULT_CONTROL_SETTINGS.maxHoldMs + 1)
    expect(input.heldEventKeys()).toEqual([])
  })

  it('lets go of everything when unbound', () => {
    bind()
    touch(movePad, 'pointerdown', 100, 100)
    touch(movePad, 'pointermove', 100, 40)
    button('event:1', 'pointerdown')
    unbind()

    expect(input.intent(5).longitudinal).toBe('idle')
    expect(input.heldEventKeys()).toEqual([])
  })
})
