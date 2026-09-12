import { Scenario } from './types';
export async function loadScenario(url: string): Promise<Scenario> {
  const res = await fetch(url);
  if (!res.ok) throw new Error('scenario fetch failed ' + url);
  return Scenario.parse(await res.json());
}
