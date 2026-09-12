import { expect, it } from 'vitest'

import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { EventBrief } from './event-brief.ts'
import { InvalidInputError } from './pipeline-error.ts'
import { writeEventBrief } from './write-event-brief.ts'

function buildBrief(overrides: Partial<EventBrief> = {}): EventBrief {
  return {
    slug: 'tilbury-arrival',
    schemaVersion: 1,
    title: 'Arrival at Tilbury',
    eventDateIso: '1948-06-22',
    eventDateDisplay: '22 June 1948',
    primaryScene: 'Tilbury Docks',
    summary: 'A summary.',
    fullArticle: 'An article.',
    narrative: 'A narrative.',
    eventContext: { before: 'a', sameDayElsewhere: 'b', after: 'c', whyItMatters: 'd' },
    pressPerspectives: [
      {
        outlet: 'The Guardian',
        coverageType: 'contemporary reporting',
        roleInStory: 'a',
        storyBeat: 'b',
      },
    ],
    worldPrompt: {
      title: 'Tilbury, 22 June 1948',
      timeWindow: 'morning',
      place: 'Tilbury Docks',
      pointOfView: 'quayside observer',
      builtEnvironment: 'dockside sheds',
      crowdLevel: 'moderate',
      sensoryModel: 'estuary light',
      hotspots: ['passenger list panel'],
      accessibility: 'captions and transcript',
      exclusions: ['invented dialogue'],
      fullPrompt: 'Generate one evidence-led world…',
    },
    caveat: 'Not the disembarkation itself.',
    uncertainFacts: ['passenger count'],
    suggestedImageQueries: ['Empire Windrush Tilbury 1948'],
    origin: {
      inputKind: 'url',
      reference: 'https://example.org/story',
      headline: 'Arrival at Tilbury',
      outlet: 'example.org',
      publishedDateText: '',
      byline: '',
      excerpt: 'An excerpt.',
      wordCount: 2,
      retrievedAtUtc: '2026-09-12T00:00:00.000Z',
      readConfidence: 'high',
      unreadablePassages: [],
    },
    corroboratingSources: [],
    imageCandidates: [],
    verification: {
      status: 'unverified',
      generatedAtUtc: '2026-09-12T00:00:00.000Z',
      composedByModel: 'gpt-5.5',
      uncertainFactCount: 1,
    },
    ...overrides,
  }
}

it('writes the brief as pretty JSON named after the slug', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'atlas-briefs-'))
  const written = await writeEventBrief(buildBrief(), { directory, overwrite: false })

  expect(written.path).toBe(join(directory, 'tilbury-arrival.json'))
  expect(written.overwritten).toBe(false)

  const parsed: unknown = JSON.parse(await readFile(written.path, 'utf8'))
  expect((parsed as EventBrief).verification.status).toBe('unverified')
})

it('refuses to clobber an existing brief unless told to', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'atlas-briefs-'))
  await writeEventBrief(buildBrief(), { directory, overwrite: false })

  await expect(() =>
    writeEventBrief(buildBrief({ summary: 'Rewritten.' }), { directory, overwrite: false }),
  ).rejects.toThrow(InvalidInputError)

  const written = await writeEventBrief(buildBrief({ summary: 'Rewritten.' }), {
    directory,
    overwrite: true,
  })
  expect(written.overwritten).toBe(true)

  const parsed: unknown = JSON.parse(await readFile(written.path, 'utf8'))
  expect((parsed as EventBrief).summary).toBe('Rewritten.')
})

it('rejects a brief whose slug could escape the output directory', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'atlas-briefs-'))
  // why: a slug that climbs out of the output directory must never be written
  await expect(
    writeEventBrief(buildBrief({ slug: '../escaped' }), { directory, overwrite: false }),
  ).rejects.toThrow()
})
