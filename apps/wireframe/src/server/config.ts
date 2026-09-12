import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

// note: every environment knob the harness reads, resolved in one place
export type ServerConfig = {
  contentDir: string
  imageBaseUrl: string
  audioBaseUrl: string
  modelId: string | undefined
  reactorApiKey: string
  ingestEnabled: boolean
  ingestToken: string
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  return {
    // note: archive paths are relative to the repository, not to whoever started the process
    contentDir: resolve(workspaceRoot(), env.ATLAS_CONTENT_DIR ?? 'content'),
    imageBaseUrl: '/api/images',
    audioBaseUrl: '/api/audio',
    modelId: env.ATLAS_WORLD_MODEL,
    reactorApiKey: env.REACTOR_API_KEY ?? '',
    ingestEnabled: env.ATLAS_INGEST_ENABLED === 'true',
    ingestToken: env.ATLAS_INGEST_TOKEN ?? '',
  }
}

// why: next runs from apps/wireframe and vitest from the repository root
function workspaceRoot(): string {
  let dir = process.cwd()
  for (let depth = 0; depth < 6; depth += 1) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir
    dir = dirname(dir)
  }
  return process.cwd()
}
