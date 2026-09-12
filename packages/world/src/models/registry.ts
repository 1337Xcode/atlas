import type { WorldModelDescriptor } from '../wire.ts'
import { LINGBOT } from './lingbot.ts'
import { LINGBOT_WORLD_2 } from './lingbot-world-2.ts'

// feat: switching world models is configuration, not code
const REGISTRY = new Map<string, WorldModelDescriptor>(
  [LINGBOT_WORLD_2, LINGBOT].map((model) => [model.id, model]),
)

// why: image anchoring plus two-axis movement plus prompt hot-swap is the best fit for an article
export const DEFAULT_WORLD_MODEL_ID = LINGBOT_WORLD_2.id

export class UnknownWorldModelError extends Error {
  readonly id: string

  constructor(id: string) {
    super(`unknown world model "${id}"; known models: ${listWorldModels().join(', ')}`)
    this.name = 'UnknownWorldModelError'
    this.id = id
  }
}

export function getWorldModel(id: string = DEFAULT_WORLD_MODEL_ID): WorldModelDescriptor {
  const model = REGISTRY.get(id)
  if (!model) throw new UnknownWorldModelError(id)
  return model
}

export function listWorldModels(): string[] {
  return [...REGISTRY.keys()]
}
