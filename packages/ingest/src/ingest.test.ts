import { authoredBrief, sampleArticle } from '@atlas/schema/testing'
import { describe, expect, it } from 'vitest'
import { createIngest } from './ingest.ts'

const token = 'ingest-secret'
const ingest = createIngest({ enabled: true, token })

describe('createIngest', () => {
  it('stays off unless it is switched on', () => {
    const off = createIngest({ enabled: false, token })
    expect(off.submit({ body: sampleArticle(), token }).status).toBe('disabled')
  })

  it('refuses a wrong token', () => {
    expect(ingest.submit({ body: sampleArticle(), token: 'nope' }).status).toBe('unauthorised')
  })

  it('refuses when no token is configured at all', () => {
    const unset = createIngest({ enabled: true, token: '' })
    expect(unset.submit({ body: sampleArticle(), token: '' }).status).toBe('unauthorised')
  })

  it('accepts a well-formed article', () => {
    const outcome = ingest.submit({ body: sampleArticle(), token })
    expect(outcome.status).toBe('accepted')
  })

  it('reports schema issues instead of throwing', () => {
    const outcome = ingest.submit({ body: { id: 'nope' }, token })
    expect(outcome.status).toBe('invalid')
    if (outcome.status === 'invalid') expect(outcome.issues.length).toBeGreaterThan(0)
  })

  it('applies the same fidelity gate as the archive', () => {
    const article = sampleArticle({
      world: authoredBrief({ environment: 'An empty street with no traffic.' }),
    })
    const outcome = ingest.submit({ body: article, token })
    expect(outcome.status).toBe('rejected')
    if (outcome.status === 'rejected') {
      expect(outcome.diagnostics.map((diagnostic) => diagnostic.rule)).toContain('prose/negation')
    }
  })

  it('guards the url draft path with the same switches', async () => {
    const off = createIngest({ enabled: false, token })
    expect((await off.draft({ url: 'https://example.org', token })).status).toBe('disabled')
    expect((await ingest.draft({ url: 'https://example.org', token: 'nope' })).status).toBe(
      'unauthorised',
    )
  })
})
