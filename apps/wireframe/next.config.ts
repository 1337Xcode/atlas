import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { NextConfig } from 'next'

// why: the api key lives in one .env at the repository root, not once per app
const rootEnv = resolve(process.cwd(), '../../.env')
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv)

// note: the atlas packages ship typescript source, so next compiles them with the app
const config: NextConfig = {
  transpilePackages: ['@atlas/archive', '@atlas/ingest', '@atlas/runtime', '@atlas/schema', '@atlas/scene', '@atlas/world'],
}

export default config
