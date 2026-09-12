import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { NextConfig } from 'next'

// why: the api key lives in one .env at the repository root, not once per app
const rootEnv = resolve(process.cwd(), '../../.env')
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv)

// note: the atlas packages ship typescript source, so next compiles them with the app
const config: NextConfig = {
  transpilePackages: [
    '@atlas/archive',
    '@atlas/ingest',
    '@atlas/runtime',
    '@atlas/schema',
    '@atlas/scene',
    '@atlas/world',
  ],
  // note: lets a loopback browser preview reach the dev server's hot-reload channel
  allowedDevOrigins: ['127.0.0.1'],
  // why: the repository keeps its own agent notes, so next must not generate a second set
  agentRules: false,
}

export default config
