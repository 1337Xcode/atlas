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
// why: commands are asynchronous and events are the source of truth, so each step is confirmed

export class StagingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StagingError'
  }
}

export type StagingDeps = {
  plan: WorldSessionPlan
  model: WorldModelDescriptor
  input: InputStore
  send: (command: Command) => Promise<ModelEvent | undefined>
  uploadAnchorImage: () => Promise<FileRefLike>
  // note: resolves true when the model confirmed, false when the wait timed out
  waitFor: (kind: ModelEvent['kind'], timeoutMs: number) => Promise<boolean>
  delay: (ms: number) => Promise<void>
}

// fn: run the documented launch sequence and return the prompt the world started with
export async function stageWorld(deps: StagingDeps): Promise<string> {
  const { plan, model, input, send } = deps
  const confirmMs = plan.controls.confirmTimeoutMs
  const prompt = composePrompt(plan.scene, input.sceneInput())

  const image = await deps.uploadAnchorImage()
  const staged = stagingCommands(model, {
    image,
    prompt,
    seed: plan.scene.seed,
    rotationSpeedDeg: plan.scene.rotationSpeedDeg,
  })

  // why: start is rejected unless the image has landed, and the first chunk renders from it
  const imageAccepted = deps.waitFor('image-accepted', confirmMs)
  await send(staged.image)
  if (!(await imageAccepted)) {
    throw new StagingError('the model never confirmed the seed image, so the world was not started')
  }

  for (const command of staged.settings) await send(command)

  // why: start is rejected unless the prompt has landed too
  const promptAccepted = deps.waitFor('prompt-accepted', confirmMs)
  await send(staged.prompt)
  if (!(await promptAccepted)) {
    throw new StagingError('the model never confirmed the prompt, so the world was not started')
  }

  await deps.delay(plan.controls.startDelayMs)

  const started = await send(model.commands.lifecycle('start'))
  if (started?.kind === 'command-error') {
    throw new StagingError(`the model refused to start: ${started.reason}`)
  }

  return prompt
}
