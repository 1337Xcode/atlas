import { z } from 'zod'

/**
 * Two schemas on purpose. `composedBriefSchema` is what the model is allowed to write:
 * prose only, no URLs, no licences. Everything checkable — sources, images, provenance —
 * is attached afterwards from the search results, so a citation can never be invented.
 *
 * Every field is required and nothing is nullable because OpenAI strict structured
 * outputs reject optional properties. "Unknown" is the empty string, documented per field.
 */

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const coverageTypeSchema = z.enum([
  'contemporary reporting',
  'editorial',
  'archive reproduction',
  'later retrospective',
])

const pressPerspectiveSchema = z.object({
  outlet: z.string(),
  coverageType: coverageTypeSchema,
  roleInStory: z.string(),
  storyBeat: z.string(),
})

const worldPromptSchema = z.object({
  title: z.string(),
  timeWindow: z.string(),
  place: z.string(),
  pointOfView: z.string(),
  builtEnvironment: z.string(),
  crowdLevel: z.string(),
  sensoryModel: z.string(),
  hotspots: z.array(z.string()),
  accessibility: z.string(),
  exclusions: z.array(z.string()),
  /** The whole brief as one pasteable block, the way research/*.md carries it today. */
  fullPrompt: z.string(),
})

const eventContextSchema = z.object({
  before: z.string(),
  sameDayElsewhere: z.string(),
  after: z.string(),
  whyItMatters: z.string(),
})

export const composedBriefSchema = z.object({
  /** Kebab-case identifier. Also the output filename, so it is re-checked before use. */
  slug: z.string(),
  title: z.string(),
  /** ISO date of the event, or empty string when the sources do not pin one down. */
  eventDateIso: z.string(),
  eventDateDisplay: z.string(),
  primaryScene: z.string(),
  summary: z.string(),
  fullArticle: z.string(),
  narrative: z.string(),
  eventContext: eventContextSchema,
  pressPerspectives: z.array(pressPerspectiveSchema),
  worldPrompt: worldPromptSchema,
  caveat: z.string(),
  /** Claims the model could not corroborate. These drive the human review pass. */
  uncertainFacts: z.array(z.string()),
  /** Archive search phrases for a rights-cleared image hunt, not image URLs. */
  suggestedImageQueries: z.array(z.string()),
})

export type ComposedBrief = z.infer<typeof composedBriefSchema>

const articleOriginSchema = z.object({
  inputKind: z.enum(['url', 'image']),
  /** The URL fetched, or the basename of the photo. Never an absolute local path. */
  reference: z.string(),
  headline: z.string(),
  outlet: z.string(),
  publishedDateText: z.string(),
  byline: z.string(),
  /**
   * Short excerpt only. The full body of a press article is somebody else's copyright,
   * and this JSON ships to the world builder.
   */
  excerpt: z.string(),
  wordCount: z.number().int().nonnegative(),
  retrievedAtUtc: z.string(),
  /**
   * How well the source could be read. A photo of newsprint is transcribed by a model that
   * misreads proper nouns, so a reviewer needs this and the passages it could not make out.
   */
  readConfidence: z.enum(['high', 'medium', 'low']),
  unreadablePassages: z.array(z.string()),
})

const corroboratingSourceSchema = z.object({
  title: z.string(),
  url: z.url(),
  publishedDate: z.string(),
  relevanceScore: z.number(),
  snippet: z.string(),
})

const imageCandidateSchema = z.object({
  url: z.url(),
  description: z.string(),
  /**
   * Always 'needs-review'. A search result carries no per-item licence statement, so
   * nothing here may be downloaded into assets/ or published until a human checks the
   * source record and records the rights in ASSET_MANIFEST.md.
   */
  rightsStatus: z.literal('needs-review'),
})

const verificationSchema = z.object({
  /** Machine output is never 'reviewed'. Only a human editing the file may set that. */
  status: z.enum(['unverified', 'reviewed']),
  generatedAtUtc: z.string(),
  composedByModel: z.string(),
  uncertainFactCount: z.number().int().nonnegative(),
})

export const eventBriefSchema = composedBriefSchema.extend({
  slug: z.string().regex(SLUG_PATTERN, 'slug must be kebab-case ASCII'),
  schemaVersion: z.literal(1),
  origin: articleOriginSchema,
  corroboratingSources: z.array(corroboratingSourceSchema),
  imageCandidates: z.array(imageCandidateSchema),
  verification: verificationSchema,
})

export type EventBrief = z.infer<typeof eventBriefSchema>
export type ArticleOrigin = z.infer<typeof articleOriginSchema>
export type CorroboratingSource = z.infer<typeof corroboratingSourceSchema>
export type ImageCandidate = z.infer<typeof imageCandidateSchema>
