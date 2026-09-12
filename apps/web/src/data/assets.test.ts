import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ScenarioSchema, type Scenario } from './types.ts'

// why: a silent 404 on a page scan is indistinguishable from a broken app during a demo
const EVENTS = ['apollo11', 'berlin1989'] as const

const root = (...parts: string[]) => resolve(process.cwd(), 'apps/web', ...parts)

function scenario(id: string): Scenario {
  return ScenarioSchema.parse(
    JSON.parse(readFileSync(root('public/events', id, 'scenario.json'), 'utf8')),
  )
}

// fn: every file the scenario points at, other than recordings, which are optional
function visualAssets(sc: Scenario): { what: string; src: string }[] {
  const refs = Object.entries(sc.pages).flatMap(([id, page]) => [
    { what: `page ${id}`, src: page.src },
    ...(page.words ? [{ what: `words ${id}`, src: page.words }] : []),
    ...(page.lines ? [{ what: `lines ${id}`, src: page.lines }] : []),
  ])
  return [...refs, { what: 'ghost', src: sc.ghost.src }]
}

describe.each(EVENTS)('the %s assets', (id) => {
  const sc = scenario(id)

  it('ships every page scan, word box and line box it references', () => {
    const missing = visualAssets(sc)
      .filter(({ src }) => !existsSync(root('public', src)))
      .map(({ what, src }) => `${what}: ${src}`)
    expect(missing).toEqual([])
  })

  it('offers the reader at least one front page in the hub', () => {
    const hubPages = Object.values(sc.pages).filter((page) => page.hub)
    expect(hubPages.length).toBeGreaterThan(0)
  })

  it('reads from a page that carries word boxes, so the text can be tracked', () => {
    const page = sc.pages[sc.readPage]
    expect(page?.words ?? page?.syntheticLines).toBeTruthy()
  })
})
