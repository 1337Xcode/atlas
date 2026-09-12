import { IDLE_SCENE_INPUT_STATE, type SceneInputState } from '@atlas/schema'
import { describe, expect, it } from 'vitest'
import { compileScene } from './compile.ts'
import { composePrompt, composeStagingPrompt } from './compose.ts'
import { authoredBrief } from '@atlas/schema/testing'

const scene = compileScene(authoredBrief(), { promptCharBudget: 2000 })

describe('composePrompt', () => {
  it('composes base, camera and movement in layer order', () => {
    const prompt = composePrompt(scene, IDLE_SCENE_INPUT_STATE)
    expect(prompt.indexOf(scene.layers.base)).toBe(0)
    expect(prompt.indexOf(scene.layers.camera.static)).toBeLessThan(
      prompt.indexOf(scene.layers.movement.static),
    )
  })

  it('swaps to the dynamic variants while the reader is moving', () => {
    const prompt = composePrompt(scene, { ...IDLE_SCENE_INPUT_STATE, moving: true })
    expect(prompt).toContain(scene.layers.camera.dynamic)
    expect(prompt).toContain(scene.layers.movement.dynamic)
    expect(prompt).not.toContain(scene.layers.movement.static)
  })

  it('appends an event clause only while its key is held', () => {
    const detail = scene.layers.events[0]?.static ?? ''
    expect(composePrompt(scene, IDLE_SCENE_INPUT_STATE)).not.toContain(detail)
    expect(composePrompt(scene, { ...IDLE_SCENE_INPUT_STATE, heldEventKeys: ['1'] })).toContain(detail)
  })

  it('ignores unknown held keys', () => {
    expect(composePrompt(scene, { ...IDLE_SCENE_INPUT_STATE, heldEventKeys: ['9'] })).toBe(
      composeStagingPrompt(scene),
    )
  })

  it('appends the jump and crouch clauses, but not stand', () => {
    expect(composePrompt(scene, { ...IDLE_SCENE_INPUT_STATE, vertical: 'jump' })).toContain(
      'rises sharply off the cobblestones',
    )
    expect(composePrompt(scene, { ...IDLE_SCENE_INPUT_STATE, vertical: 'crouch' })).toContain(
      'lowers toward the ground',
    )
    expect(composePrompt(scene, { ...IDLE_SCENE_INPUT_STATE, vertical: 'stand' })).toBe(
      composeStagingPrompt(scene),
    )
  })

  it('trims held events before the contracts when the budget is tight', () => {
    const tight = compileScene(authoredBrief(), { promptCharBudget: 1000 })
    const prompt = composePrompt(tight, { moving: true, heldEventKeys: ['1'], vertical: 'crouch' })
    expect(prompt).toContain(tight.layers.base)
    expect(prompt).toContain(tight.layers.camera.dynamic)
    expect(prompt).toContain(tight.layers.movement.dynamic)
    expect(prompt).not.toContain(tight.layers.events[0]?.dynamic)
  })

  it('stays inside the model budget for every input state', () => {
    for (const moving of [false, true]) {
      for (const vertical of ['stand', 'jump', 'crouch'] as const) {
        const prompt = composePrompt(scene, { moving, vertical, heldEventKeys: ['1'] })
        expect(prompt.length).toBeLessThanOrEqual(scene.promptCharBudget)
      }
    }
  })

  it('is stable for the same input state', () => {
    const input: SceneInputState = { moving: true, heldEventKeys: ['1'], vertical: 'jump' }
    expect(composePrompt(scene, input)).toBe(composePrompt(scene, input))
  })
})
