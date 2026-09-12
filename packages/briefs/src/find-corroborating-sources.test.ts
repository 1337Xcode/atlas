import { expect, it } from 'vitest'

import { buildSearchQuery } from './find-corroborating-sources.ts'
import { InvalidInputError } from './pipeline-error.ts'

it('uses a full headline on its own', () => {
  const headline = 'Ukraine marks 40th anniversary of Chernobyl disaster'
  expect(buildSearchQuery({ headline, bodyText: 'Ceremonies were held.' })).toBe(headline)
})

it('pads a fragment of a headline with the opening of the body', () => {
  const query = buildSearchQuery({
    headline: 'NAMES AND DESCRIPTIONS',
    bodyText: 'Name of Ship Empire Windrush, port of arrival Tilbury, June 1948.',
  })

  expect(query).toMatch(/^NAMES AND DESCRIPTIONS Name of Ship Empire Windrush/)
})

it('falls back to the body when there is no headline at all', () => {
  const query = buildSearchQuery({ headline: '   ', bodyText: 'Crowds gathered at the quayside.' })
  expect(query).toBe('Crowds gathered at the quayside.')
})

it('caps the body contribution so the query stays a query', () => {
  const bodyText = Array.from({ length: 60 }, (_, index) => `word${index}`).join(' ')
  const query = buildSearchQuery({ headline: '', bodyText })

  expect(query.split(' ').length).toBe(18)
})

it('refuses an article with nothing to search on', () => {
  expect(() => buildSearchQuery({ headline: '', bodyText: '   ' })).toThrow(InvalidInputError)
})
