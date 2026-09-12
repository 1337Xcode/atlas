import { composePrompt } from '@atlas/scene'
import type { WorldSessionPlan } from '@atlas/schema'
import {
  stagingCommands,
  type Command,
  type FileRefLike,
  type WorldModelDescriptor,
} from '@atlas/world'
import type { InputStore } from './input.ts'
import type { ModelEvent } from './messages.ts'

// docs: https://docs.reactor.inc/model-api-reference/lingbot-world-2/tutorial#starting-a-scene

export type StagingDeps = {
  plan: WorldSessionPlan
  model: WorldModelDescriptor
  input: InputStore
  send: (command: Command) => Promise<ModelEvent | undefined>
  uploadAnchorImage: () => Promise<FileRefLike>
  // note: resolves on the named model event, or on timeout, so staging cannot hang
  waitFor: (kind: ModelEvent['kind'], timeoutMs: number) => Promise<void>
  delay: (ms: number) => Promise<void>
}

// fn: run the documented launch sequence and return the prompt the world started with
export async function stageWorld(deps: StagingDeps): Promise<string> {
  const { plan, model, input, send } = deps
  const prompt = composePrompt(plan.scene, input.sceneInput())

  const image = await deps.uploadAnchorImage()
  const staged = stagingCommands(model, {
    image,
    prompt,
    seed: plan.scene.seed,
    rotationSpeedDeg: plan.scene.rotationSpeedDeg,
  })

  // why: the first chunk must render from the seed image, so wait for the model to decode it
  const accepted = deps.waitFor('image-accepted', plan.controls.imageSettleMs)
  await send(staged.image)
  await accepted

  for (const command of staged.settings) await send(command)
  await send(staged.prompt)

  // why: start is rejected unless both the prompt and the image have landed
  await deps.delay(plan.controls.startDelayMs)
  await send(model.commands.lifecycle('start'))

  return prompt
}
