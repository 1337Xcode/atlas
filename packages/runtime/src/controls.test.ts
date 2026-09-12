import { DEFAULT_CONTROL_SETTINGS, LINGBOT, LINGBOT_WORLD_2 } from '@atlas/world'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { bindControls } from './controls.ts'
import { createInputStore, type InputStore } from './input.ts'

let input: InputStore
let surface: HTMLElement
let outside: HTMLElement
let unbind: () => void
let changes: number
let activity: number

function bind(capabilities = LINGBOT_WORLD_2.capabilities, settings = DEFAULT_CONTROL_SETTINGS) {
  unbind = bindControls({
    surface,
    input,
    settings:
      settings.strafeMode === 'lateral' && !capabilities.move.lateral
        ? { ...settings, strafeMode: 'turn' }
        : settings,
    capabilities,
    eventKeys: ['1'],
    onChange: () => {
      changes += 1
    },
    onActivity: () => {
      activity += 1
    },
  })
}

// note: the reader clicks the world to give it the keyboard
function enter(target: HTMLElement = surface) {
  target.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
}

function key(type: 'keydown' | 'keyup', code: string, init: KeyboardEventInit = {}) {
  window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true, ...init }))
}

function move(dx: number, dy: number) {
  const event = new MouseEvent('mousemove', { bubbles: true })
  Object.defineProperty(event, 'movementX', { value: dx })
  Object.defineProperty(event, 'movementY', { value: dy })
  window.dispatchEvent(event)
}

beforeEach(() => {
  vi.useFakeTimers()
  input = createInputStore()
  surface = document.createElement('div')
  surface.tabIndex = 0
  outside = document.createElement('button')
  document.body.append(surface, outside)
  changes = 0
  activity = 0
})

afterEach(() => {
  unbind()
  surface.remove()
  outside.remove()
  vi.useRealTimers()
})

describe('bindControls', () => {
  it('ignores the keyboard until the reader clicks the world', () => {
    bind()
    key('keydown', 'KeyW')
    expect(input.intent(5).longitudinal).toBe('idle')
  })

  // why: safari on macos never focuses a div on click, so the keys cannot depend on dom focus
  it('drives the world from window key events once clicked, without needing focus', () => {
    bind()
    enter()
    key('keydown', 'KeyW')
    expect(input.intent(5).longitudinal).toBe('forward')
  })

  it('maps WASD to the two movement axes', () => {
    bind()
    enter()
    key('keydown', 'KeyW')
    key('keydown', 'KeyA')
    expect(input.intent(5)).toMatchObject({ longitudinal: 'forward', lateral: 'strafe_left' })

    key('keyup', 'KeyW')
    expect(input.intent(5).longitudinal).toBe('idle')
  })

  // why: `code` is layout independent, so the same physical keys work on any keyboard
  it('reads physical key positions, not the characters they produce', () => {
    bind()
    enter()
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', key: 'z', bubbles: true }))
    expect(input.intent(5).longitudinal).toBe('forward')
  })

  it('routes A and D through turning when the model has no lateral axis', () => {
    bind(LINGBOT.capabilities)
    enter()
    key('keydown', 'KeyD')
    expect(input.intent(5)).toMatchObject({ lateral: 'idle', lookHorizontal: 'right' })
  })

  it('maps the arrow keys to look', () => {
    bind()
    enter()
    key('keydown', 'ArrowLeft')
    key('keydown', 'ArrowUp')
    expect(input.intent(5)).toMatchObject({ lookHorizontal: 'left', lookVertical: 'up' })
  })

  it('triggers a jump on space and a crouch dip on c', () => {
    bind()
    enter()
    key('keydown', 'Space')
    expect(input.isJumping()).toBe(true)

    key('keydown', 'KeyC')
    expect(input.consumeCrouchDip()).toBe('down')
  })

  it('offers no vertical controls on a model without a pose channel', () => {
    bind(LINGBOT.capabilities)
    enter()
    key('keydown', 'Space')
    key('keydown', 'KeyC')
    expect(input.isJumping()).toBe(false)
    expect(input.sceneInput().vertical).toBe('stand')
  })

  it('holds a scene event while its number key is down', () => {
    bind()
    enter()
    key('keydown', 'Digit1')
    expect(input.heldEventKeys()).toEqual(['1'])
    key('keyup', 'Digit1')
    expect(input.heldEventKeys()).toEqual([])
  })

  it('ignores a number key the scene does not bind', () => {
    bind()
    enter()
    key('keydown', 'Digit7')
    expect(input.heldEventKeys()).toEqual([])
  })

  it('releases a held event by itself, so a long hold cannot accumulate drift', () => {
    bind()
    enter()
    key('keydown', 'Digit1')
    vi.advanceTimersByTime(DEFAULT_CONTROL_SETTINGS.maxHoldMs + 1)
    expect(input.heldEventKeys()).toEqual([])
  })

  it('ignores key repeat, since the wire already holds that state', () => {
    bind()
    enter()
    key('keydown', 'KeyW')
    const afterFirst = changes
    key('keydown', 'KeyW', { repeat: true })
    expect(changes).toBe(afterFirst)
  })

  // why: pointer lock can be refused, so dragging has to look around too
  it('looks around by dragging when the pointer is not locked', () => {
    bind()
    enter()
    move(12, -4)
    expect(input.consumeLook()).toEqual({ dxPx: 12, dyPx: -4 })
  })

  it('stops looking when the drag ends', () => {
    bind()
    enter()
    window.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }))
    move(12, -4)
    expect(input.consumeLook()).toEqual({ dxPx: 0, dyPx: 0 })
  })

  it('reports every input as activity, so the idle timer stays honest', () => {
    bind()
    enter()
    const before = activity
    key('keydown', 'KeyW')
    move(5, 5)
    expect(activity).toBeGreaterThan(before + 1)
  })

  it('hands the keyboard back when the reader clicks outside the world', () => {
    bind()
    enter()
    key('keydown', 'KeyW')
    enter(outside)
    expect(input.intent(5).longitudinal).toBe('idle')

    key('keydown', 'KeyW')
    expect(input.intent(5).longitudinal).toBe('idle')
  })

  it('leaves typing alone', () => {
    bind()
    enter()
    const field = document.createElement('input')
    document.body.append(field)
    field.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true }))
    expect(input.intent(5).longitudinal).toBe('idle')
    field.remove()
  })

  it('sweeps every held key when the window loses focus', () => {
    bind()
    enter()
    key('keydown', 'KeyW')
    key('keydown', 'Digit1')
    window.dispatchEvent(new Event('blur'))
    expect(input.intent(5).longitudinal).toBe('idle')
    expect(input.heldEventKeys()).toEqual([])
  })

  it('stops driving the world once unbound', () => {
    bind()
    enter()
    unbind()
    key('keydown', 'KeyW')
    expect(input.intent(5).longitudinal).toBe('idle')
  })
})

describe('looking around without pointer lock', () => {
  it('turns from plain mouse movement over the world', () => {
    bind()
    enter()
    const event = new MouseEvent('mousemove', { bubbles: true })
    Object.defineProperty(event, 'movementX', { value: 9 })
    Object.defineProperty(event, 'movementY', { value: 0 })
    surface.dispatchEvent(event)
    expect(input.consumeLook().dxPx).toBe(9)
  })

  it('ignores movement over the page when the world was never clicked', () => {
    bind()
    move(9, 0)
    expect(input.consumeLook()).toEqual({ dxPx: 0, dyPx: 0 })
  })
})
