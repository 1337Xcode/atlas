import { ImageNotFoundError, readArchiveImage } from '@atlas/archive'
import { getArchive } from '@/server/archive.ts'

// feat: serves archive images, including the anchor frame the browser uploads to reactor
export async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params

  try {
    const image = await readArchiveImage(getArchive().imagesDir, path.join('/'))
    return new Response(new Uint8Array(image.bytes), {
      headers: {
        'Content-Type': image.mimeType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (cause) {
    if (cause instanceof ImageNotFoundError) {
      return Response.json({ error: cause.message }, { status: 404 })
    }
    throw cause
  }
}
