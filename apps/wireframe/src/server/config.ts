import { resolve } from 'node:path'

// note: every environment knob the harness reads, resolved in one place
export type ServerConfig = {
  contentDir: string
  imageBaseUrl: string
  modelId: string | undefined
  reactorApiKey: string
  ingestEnabled: boolean
  ingestToken: string
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  return {
    // note: the archive lives at the repository root, not inside this app
    contentDir: resolve(process.cwd(), env.ATLAS_CONTENT_DIR ?? '../../content'),
    imageBaseUrl: '/api/images',
    modelId: env.ATLAS_WORLD_MODEL,
    reactorApiKey: env.REACTOR_API_KEY ?? '',
    ingestEnabled: env.ATLAS_INGEST_ENABLED === 'true',
    ingestToken: env.ATLAS_INGEST_TOKEN ?? '',
  }
}
