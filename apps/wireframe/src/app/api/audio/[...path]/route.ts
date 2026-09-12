import { getArchive } from '@/server/archive.ts'
import { serveArchiveAsset } from '@/server/assets.ts'

// feat: archive recordings, since the world model publishes no audio track of its own
export async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params
  return serveArchiveAsset(getArchive().audioDir, path)
}
