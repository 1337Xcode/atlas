import { expect, it } from 'vitest'

import { toBriefSlug } from './brief-slug.ts'
import { InvalidInputError } from './pipeline-error.ts'

it('lowercases and hyphenates a title', () => {
  expect(toBriefSlug('Berlin Wall Opening')).toBe('berlin-wall-opening')
})

it('strips accents and punctuation', () => {
  expect(toBriefSlug('Bandung: Conférence).toBe(1955'), 'bandung-conference-1955')
})

it('refuses path separators and traversal', () => {
  expect(toBriefSlug('../../etc/passwd')).toBe('etc-passwd')
  expect(() => toBriefSlug('../..')).toThrow(InvalidInputError)
  expect(() => toBriefSlug('/')).toThrow(InvalidInputError)
})

it('refuses a slug with nothing usable in it', () => {
  expect(() => toBriefSlug('   ')).toThrow(InvalidInputError)
  expect(() => toBriefSlug('日本語')).toThrow(InvalidInputError)
})

it('truncates without leaving a trailing hyphen', () => {
  const slug = toBriefSlug(`${'a'.repeat(78)} bcdefg`)
  expect(slug.length <= 80).toBe(true)
  expect(slug.endsWith('-')).toBe(false)
})
