import { AssetNotFoundError, readArchiveFile } from '@atlas/archive'

// fn: serve one archive asset, immutably cached, refusing anything outside its directory
export async function serveArchiveAsset(root: string, segments: string[]): Promise<Response> {
  try {
    const asset = await readArchiveFile(root, segments.join('/'))
    return new Response(new Uint8Array(asset.bytes), {
      headers: {
        'Content-Type': asset.mimeType,
        // why: archive assets never change under the same path, so they cache forever
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (cause) {
    if (cause instanceof AssetNotFoundError) {
      return Response.json({ error: cause.message }, { status: 404 })
    }
    throw cause
  }
}
