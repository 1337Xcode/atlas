import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ArchiveCatalogueClient } from './client.ts'
import { localPaths } from './paths.ts'

// why: "the archive did not open" was a whole catalogue lost to one bad fetch
function serveFromDisk(broken: string[] = []) {
  return vi.fn((input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const id = url.match(/events\/([^/]+)\//)?.[1] ?? ''
    if (broken.includes(id)) return Promise.resolve(new Response('nope', { status: 500 }))
    const body = readFileSync(resolve(process.cwd(), 'apps/web/public', url.replace(/^\//, '')))
    return Promise.resolve(new Response(body, { status: 200 }))
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ArchiveCatalogueClient', () => {
  it('lists every event it can read', async () => {
    vi.stubGlobal('fetch', serveFromDisk())
    const clusters = await new ArchiveCatalogueClient().listClusters()

    expect(clusters.map((cluster) => cluster.id)).toEqual(['apollo11', 'berlin1989'])
    expect(clusters[0]?.pages.length).toBeGreaterThan(0)
  })

  it('keeps the readable events when one of them fails', async () => {
    vi.stubGlobal('fetch', serveFromDisk(['berlin1989']))
    const clusters = await new ArchiveCatalogueClient().listClusters()

    expect(clusters.map((cluster) => cluster.id)).toEqual(['apollo11'])
  })

  it('returns nothing rather than throwing when the archive is unreachable', async () => {
    vi.stubGlobal('fetch', serveFromDisk(['apollo11', 'berlin1989']))
    await expect(new ArchiveCatalogueClient().listClusters()).resolves.toEqual([])
  })

  it('reads a scenario from the path the catalogue publishes', async () => {
    vi.stubGlobal('fetch', serveFromDisk())
    const scenario = await new ArchiveCatalogueClient().getScenario('apollo11')

    expect(scenario.id).toBe('apollo11')
    expect(localPaths.scenario('apollo11')).toBe('/events/apollo11/scenario.json')
  })
})
