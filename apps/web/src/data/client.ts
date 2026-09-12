import type { Cluster, Manifest, Scenario } from './types';
import { loadScenario } from './scenario';
import { loadManifest } from './manifest';

export interface CatalogueClient {
  listClusters(): Promise<Cluster[]>;
  getScenario(clusterId: string): Promise<Scenario>;
  getManifest(clusterId: string): Promise<Manifest>;
}

export class FixtureCatalogueClient implements CatalogueClient {
  async listClusters(): Promise<Cluster[]> { return []; }
  async getScenario(id: string): Promise<Scenario> { throw new Error('fixture has no scenario for ' + id); }
  async getManifest(id: string): Promise<Manifest> { return { event: id, assets: [] }; }
}

const EVENTS = ['apollo11', 'berlin1989'] as const;

export class LocalEventClient implements CatalogueClient {
  private base = '/assets/events/';
  async listClusters(): Promise<Cluster[]> {
    const out: Cluster[] = [];
    for (const id of EVENTS) {
      const sc = await this.getScenario(id);
      out.push({ id, label: sc.title, date: sc.date, eventId: id, pages: Object.entries(sc.pages).filter(([, p]) => p.hub).map(([pid, p]) => ({ id: pid, title: p.label, thumb: p.src })) });
    }
    return out;
  }
  getScenario(id: string) { return loadScenario(this.base + id + '/scenario.json'); }
  getManifest(id: string) { return loadManifest(this.base + id + '/manifest.json'); }
}

export class CompositeClient implements CatalogueClient {
  constructor(private clients: CatalogueClient[]) {}
  async listClusters() { return (await Promise.all(this.clients.map((c) => c.listClusters()))).flat(); }
  async getScenario(id: string) { for (const c of this.clients) { try { return await c.getScenario(id); } catch { /* next */ } } throw new Error('no scenario ' + id); }
  async getManifest(id: string) { for (const c of this.clients) { try { return await c.getManifest(id); } catch { /* next */ } } throw new Error('no manifest ' + id); }
}

export const catalogue: CatalogueClient = new CompositeClient([new FixtureCatalogueClient(), new LocalEventClient()]);
