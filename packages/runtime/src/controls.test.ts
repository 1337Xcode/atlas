import { DEFAULT_CONTROL_SETTINGS, LINGBOT, LINGBOT_WORLD_2 } from '@atlas/world'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { bindControls } from './controls.ts'
import { createInputStore, type InputStore } from './input.ts'

let input: InputStore
let surface: HTMLElement
let unbind: () => void
let changes: number

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
  })
}

function key(type: 'keydown' | 'keyup', value: string, init: KeyboardEventInit = {}) {
  surface.dispatchEvent(new KeyboardEvent(type, { key: value, bubbles: true, ...init }))
}

beforeEach(() => {
  vi.useFakeTimers()
  input = createInputStore()
  surface = document.createElement('div')
  document.body.append(surface)
  changes = 0
})

afterEach(() => {
  unbind()
  surface.remove()
  vi.useRealTimers()
})

describe('bindControls', () => {
  it('maps WASD to the two movement axes', () => {
    bind()
    key('keydown', 'w')
    key('keydown', 'a')
    expect(input.intent(5)).toMatchObject({ longitudinal: 'forward', lateral: 'strafe_left' })

    key('keyup', 'w')
    expect(input.intent(5).longitudinal).toBe('idle')
  })

  it('routes A and D through turning when the model has no lateral axis', () => {
    bind(LINGBOT.capabilities)
    key('keydown', 'd')
    expect(input.intent(5)).toMatchObject({ lateral: 'idle', lookHorizontal: 'right' })
  })

  it('maps the arrow keys to look', () => {
    bind()
    key('keydown', 'ArrowLeft')
    key('keydown', 'ArrowUp')
    expect(input.intent(5)).toMatchObject({ lookHorizontal: 'left', lookVertical: 'up' })
  })

  it('triggers a jump on space and a crouch hold on c', () => {
    bind()
    key('keydown', ' ')
    expect(input.isJumping()).toBe(true)

    key('keydown', 'c')
    expect(input.sceneInput().vertical).toBe('jump')
    key('keyup', ' ')
    expect(input.consumeCrouchDip()).toBe('down')
  })

  it('offers no vertical controls on a model without a pose channel', () => {
    bind(LINGBOT.capabilities)
    key('keydown', ' ')
    key('keydown', 'c')
    expect(input.isJumping()).toBe(false)
    expect(input.sceneInput().vertical).toBe('stand')
  })

  it('holds a scene event while its number key is down', () => {
    bind()
    key('keydown', '1')
    expect(input.heldEventKeys()).toEqual(['1'])
    key('keyup', '1')
    expect(input.heldEventKeys()).toEqual([])
  })

  it('ignores a number key the scene does not bind', () => {
    bind()
    key('keydown', '7')
    expect(input.heldEventKeys()).toEqual([])
  })

  it('releases a held event by itself, so a long hold cannot accumulate drift', () => {
    bind()
    key('keydown', '1')
    vi.advanceTimersByTime(DEFAULT_CONTROL_SETTINGS.maxHoldMs + 1)
    expect(input.heldEventKeys()).toEqual([])
  })

  it('ignores key repeat, since the wire already holds that state', () => {
    bind()
    key('keydown', 'w')
    const afterFirst = changes
    key('keydown', 'w', { repeat: true })
    expect(changes).toBe(afterFirst)
  })

  it('leaves typing alone', () => {
    bind()
    const field = document.createElement('input')
    surface.append(field)
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', bubbles: true }))
    expect(input.intent(5).longitudinal).toBe('idle')
  })

  it('sweeps every held key when the window loses focus', () => {
    bind()
    key('keydown', 'w')
    key('keydown', '1')
    window.dispatchEvent(new Event('blur'))
    expect(input.intent(5).longitudinal).toBe('idle')
    expect(input.heldEventKeys()).toEqual([])
  })

  it('accumulates mouse movement only while the pointer is locked', () => {
    bind()
    surface.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }))
    expect(input.consumeLook()).toEqual({ dxPx: 0, dyPx: 0 })
  })

  it('stops driving the world once unbound', () => {
    bind()
    unbind()
    key('keydown', 'w')
    expect(input.intent(5).longitudinal).toBe('idle')
  })
})
