import { IDLE_SCENE_INPUT_STATE, type CompiledScene, type SceneInputState } from '@atlas/schema'
import { sceneBudgetFor } from './budget.ts'

// docs: prompt = base + camera[isMoving] + movement[isMoving] + heldEvents + vertical

// fn: compose the single prose string the model sees for the current input state
export function composePrompt(scene: CompiledScene, input: SceneInputState): string {
  const { layers } = scene
  const contract = [
    layers.base,
    input.moving ? layers.camera.dynamic : layers.camera.static,
    layers.guards,
    input.moving ? layers.movement.dynamic : layers.movement.static,
  ].filter((part) => part.length > 0)

  const held = layers.events
    .filter((event) => input.heldEventKeys.includes(event.key))
    .map((event) => (input.moving ? event.dynamic : event.static))

  const vertical = verticalClause(scene, input)
  const budget = sceneBudgetFor(scene.promptCharBudget).composed

  // why: trim events first — the base and the contracts must never fall off the tail
  const tail = vertical ? [...held, vertical] : [...held]
  while (tail.length > 0 && length([...contract, ...tail]) > budget) tail.pop()

  return [...contract, ...tail].join(' ')
}

// fn: the prompt staged before start, with nothing held
export function composeStagingPrompt(scene: CompiledScene): string {
  return composePrompt(scene, IDLE_SCENE_INPUT_STATE)
}

// why: only jump and crouch are engaged states; `stand` is the sentence for leaving a crouch
function verticalClause(scene: CompiledScene, input: SceneInputState): string {
  const vertical = scene.layers.vertical
  if (!vertical) return ''
  if (input.vertical === 'jump') return vertical.jump
  if (input.vertical === 'crouch') return vertical.crouch
  return ''
}

function length(parts: readonly string[]): number {
  return parts.join(' ').length
}
