// note: the public surface of the brief pipeline, in the order a brief is built

export { resolveArticleInput, type ArticleInput } from './article-input.ts'
export { extractArticlePage } from './extract-article-page.ts'
export { readArticleImage } from './read-article-image.ts'
export { buildSearchQuery, findCorroboratingSources } from './find-corroborating-sources.ts'
export { composeEventBrief } from './compose-event-brief.ts'
export { buildEventBrief } from './build-event-brief.ts'
export { writeEventBrief } from './write-event-brief.ts'
export { measureBriefSections, describeSectionsOutsideTarget } from './brief-shape-report.ts'
export { toBriefSlug } from './brief-slug.ts'
export { BRIEF_COMPOSITION_RULES } from './brief-composition-rules.ts'
export { composedBriefSchema, eventBriefSchema, SLUG_PATTERN } from './event-brief.ts'
export { readPipelineConfig } from './pipeline-config.ts'
export {
  ConfigurationError,
  InvalidInputError,
  UpstreamServiceError,
  exitCodeFor,
} from './pipeline-error.ts'
