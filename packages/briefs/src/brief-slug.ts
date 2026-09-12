import { InvalidInputError } from './pipeline-error.ts'
import { SLUG_PATTERN } from './event-brief.ts'

/**
 * The slug becomes a filename, and it arrives from model output, so it is normalised to
 * kebab-case ASCII and then checked against the pattern. Nothing else is accepted — that
 * is what keeps `..` and separators out of the output path.
 */
export function toBriefSlug(proposed: string): string {
  const normalised = proposed
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '')

  if (!SLUG_PATTERN.test(normalised)) {
    throw new InvalidInputError(`Cannot build a filename slug from "${proposed}"`)
  }
  return normalised
}
