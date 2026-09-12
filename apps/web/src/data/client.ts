import { loadManifest } from './manifest'
import { localPaths, type AssetPaths } from './paths'
import { loadScenario } from './scenario'
import type { Cluster, Manifest, Scenario } from './types'

// why: the newspaper reads through this interface only, so the archive behind it can change
export interface CatalogueClient {
  listClusters(): Promise<Cluster[]>
  getScenario(clusterId: string): Promise<Scenario>
  getManifest(clusterId: string): Promise<Manifest>
}

// note: the events the local archive ships with, in the order the hub shows them
export const LOCAL_EVENTS = ['apollo11', 'berlin1989'] as const

// fn: reads scenarios and manifests from wherever the given paths point
export class ArchiveCatalogueClient implements CatalogueClient {
  private readonly paths: AssetPaths
  private readonly events: readonly string[]

  constructor(paths: AssetPaths = localPaths, events: readonly string[] = LOCAL_EVENTS) {
    this.paths = paths
    this.events = events
  }

  async listClusters(): Promise<Cluster[]> {
    const scenarios = await Promise.all(
      this.events.map(async (id) => ({ id, scenario: await this.getScenario(id) })),
    )
    return scenarios.map(({ id, scenario }) => ({
      id,
      label: scenario.title,
      date: scenario.date,
      eventId: id,
      // note: only the pages the scenario marks for the hub are offered to the reader
      pages: Object.entries(scenario.pages)
        .filter(([, page]) => page.hub)
        .map(([pageId, page]) => ({ id: pageId, title: page.label, thumb: page.src })),
    }))
  }

  getScenario(id: string): Promise<Scenario> {
    return loadScenario(this.paths.scenario(id))
  }

  getManifest(id: string): Promise<Manifest> {
    return loadManifest(this.paths.manifest(id))
  }
}

// fn: try each catalogue in turn, so a local archive can stand in for a remote one
export class CompositeCatalogueClient implements CatalogueClient {
  private readonly clients: readonly CatalogueClient[]

  constructor(clients: readonly CatalogueClient[]) {
    this.clients = clients
  }

  async listClusters(): Promise<Cluster[]> {
    const lists = await Promise.all(
      this.clients.map((client) => client.listClusters().catch(() => [] as Cluster[])),
    )
    return lists.flat()
  }

  async getScenario(id: string): Promise<Scenario> {
    return this.firstOf((client) => client.getScenario(id), `no scenario for "${id}"`)
  }

  async getManifest(id: string): Promise<Manifest> {
    return this.firstOf((client) => client.getManifest(id), `no manifest for "${id}"`)
  }

  private async firstOf<T>(read: (client: CatalogueClient) => Promise<T>, message: string) {
    for (const client of this.clients) {
      try {
        return await read(client)
      } catch {
        // note: fall through to the next catalogue
      }
    }
    throw new Error(message)
  }
}

// note: the default the app runs on until the archive api is wired in
export const catalogue: CatalogueClient = new ArchiveCatalogueClient()
