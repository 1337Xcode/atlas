import { ManifestSchema, type Manifest } from './types'

export async function loadManifest(url: string): Promise<Manifest> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`manifest fetch failed: ${url}`)
  return ManifestSchema.parse(await response.json())
}

// fn: how an asset was made, defaulting to a record rather than a reconstruction
export function layerOf(manifest: Manifest, id: string) {
  return manifest.assets.find((asset) => asset.id === id)?.layer ?? 'deterministic'
}
