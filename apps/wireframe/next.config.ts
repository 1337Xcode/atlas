import type { NextConfig } from 'next'

// note: the atlas packages ship typescript source, so next compiles them with the app
const config: NextConfig = {
  transpilePackages: ['@atlas/archive', '@atlas/ingest', '@atlas/runtime', '@atlas/schema', '@atlas/scene', '@atlas/world'],
}

export default config
