import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ScenarioSchema } from './types.ts'

// why: the contracts and the authored scenarios drifted apart once already, silently
const EVENTS = ['apollo11', 'berlin1989'] as const

// note: anchored to the workspace root, since vitest runs from there in either environment
function scenarioFile(id: string): unknown {
  const path = resolve(process.cwd(), 'apps/web/public/events', id, 'scenario.json')
  return JSON.parse(readFileSync(path, 'utf8')) as unknown
}

describe.each(EVENTS)('the %s scenario', (id) => {
  const parsed = ScenarioSchema.safeParse(scenarioFile(id))

  it('matches the contract the app parses it with', () => {
    expect(parsed.error?.issues ?? []).toEqual([])
    expect(parsed.success).toBe(true)
  })

  it('carries the journey through to its end', () => {
    const phases = new Set(parsed.data?.beats.map((beat) => beat.phase))
    for (const phase of ['hub', 'read', 'door', 'world', 'return', 'end']) {
      expect(phases).toContain(phase)
    }
  })

  it('orders its beats, so the sampler can walk them forwards', () => {
    const times = parsed.data?.beats.map((beat) => beat.t) ?? []
    expect(times).toEqual([...times].sort((a, b) => a - b))
  })

  it('points every mark at a page that exists', () => {
    const pages = Object.keys(parsed.data?.pages ?? {})
    for (const mark of parsed.data?.marks ?? []) expect(pages).toContain(mark.page)
  })

  it('names a readable page and a world objective', () => {
    expect(Object.keys(parsed.data?.pages ?? {})).toContain(parsed.data?.readPage)
    expect(parsed.data?.world.objective).toBeTruthy()
  })
})
