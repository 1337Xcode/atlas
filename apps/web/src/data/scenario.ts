import { ScenarioSchema, type Scenario } from './types'

export async function loadScenario(url: string): Promise<Scenario> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`scenario fetch failed: ${url}`)
  return ScenarioSchema.parse(await response.json())
}
