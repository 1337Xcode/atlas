import { createArchive, type Archive } from '@atlas/archive'
import { getWorldModel, type WorldModelDescriptor } from '@atlas/world'
import { readConfig } from './config.ts'

let cached: { archive: Archive; model: WorldModelDescriptor } | undefined

// fn: one archive and one model for the process, loaded on first use
export function getArchive(): Archive {
  return load().archive
}

export function getModel(): WorldModelDescriptor {
  return load().model
}

function load() {
  if (!cached) {
    const config = readConfig()
    cached = {
      archive: createArchive({
        contentDir: config.contentDir,
        imageBaseUrl: config.imageBaseUrl,
        ...(config.modelId === undefined ? {} : { modelId: config.modelId }),
      }),
      model: getWorldModel(config.modelId),
    }
  }
  return cached
}
