import { describe, expect, it } from 'vitest'
import { compileScene } from './compile.ts'
import { authoredBrief, promptBrief } from './scene.fixture.ts'

const options = { promptCharBudget: 2000 }

describe('compileScene', () => {
  it('pins every landmark with an explicit count', () => {
    const scene = compileScene(authoredBrief(), options)
    expect(scene.layers.base).toContain(
      'The world contains EXACTLY ONE graffitied concrete wall segment straight ahead at a fixed position AND EXACTLY ONE steel floodlight mast on the left at a fixed position',
    )
  })

  it('keeps camera language out of the base and inside both camera variants', () => {
    const scene = compileScene(authoredBrief(), options)
    expect(scene.layers.base).not.toMatch(/look-input/)
    expect(scene.layers.camera.static).toContain('look-input is the only source of camera motion')
    expect(scene.layers.camera.dynamic).toContain('Strict first-person view')
  })

  it('keeps prop guards in their own layer, never in the base', () => {
    const scene = compileScene(authoredBrief(), options)
    expect(scene.layers.guards).toBe('any tool in a raised hand visible ahead in frame.')
    expect(scene.layers.base).not.toContain('any tool in a raised hand')
  })

  it('expands a single event detail into both movement variants', () => {
    const scene = compileScene(authoredBrief(), options)
    const event = scene.layers.events[0]
    expect(event?.key).toBe('1')
    expect(event?.static).toBe(event?.dynamic)
  })

  it('carries the authored seed and rotation speed through', () => {
    const scene = compileScene(authoredBrief(), options)
    expect(scene.seed).toBe(1989)
    expect(scene.rotationSpeedDeg).toBe(5)
  })

  it('is deterministic', () => {
    expect(compileScene(authoredBrief(), options)).toEqual(compileScene(authoredBrief(), options))
  })

  it('fills the contracts around a free-prompt brief', () => {
    const scene = compileScene(promptBrief(), options)
    expect(scene.layers.base).toContain('9 November 1989')
    expect(scene.layers.camera.static).toContain('First-person view')
    expect(scene.layers.movement.static).toContain('holds steady in the foreground')
    expect(scene.layers.events).toEqual([])
  })

  it('omits the vertical layer when the brief has none', () => {
    expect(compileScene(promptBrief(), options).layers.vertical).toBeUndefined()
  })
})
