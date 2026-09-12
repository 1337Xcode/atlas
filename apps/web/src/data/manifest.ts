import { Manifest } from './types';
export async function loadManifest(url: string): Promise<Manifest> {
  const res = await fetch(url);
  if (!res.ok) throw new Error('manifest fetch failed ' + url);
  return Manifest.parse(await res.json());
}
export function layerOf(manifest: Manifest, id: string) { return manifest.assets.find((a) => a.id === id)?.layer ?? 'deterministic'; }
