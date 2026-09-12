import { z } from 'zod'

import { ConfigurationError } from './pipeline-error.ts'

/**
 * Defaults target Groq's OpenAI-compatible endpoint, checked on 2026-09-12. Two models
 * because no single Groq model does both jobs: strict structured output is limited to
 * gpt-oss-* and qwen3.8, and of those only qwen3.8 accepts images. qwen3.6 returns 400 on
 * a strict schema. Point LLM_BASE_URL at OpenAI and set both models if you move providers.
 */
const environmentSchema = z.object({
  GROQ_API_KEY: z.string().min(1, 'GROQ_API_KEY is empty'),
  TAVILY_API_KEY: z.string().min(1, 'TAVILY_API_KEY is empty'),
  LLM_BASE_URL: z.url().default('https://api.groq.com/openai/v1'),
  /** Reads photographs of clippings. Must accept image input and a strict JSON schema. */
  SCAN_MODEL: z.string().min(1).default('qwen/qwen3.8-27b'),
  /** Writes the brief. Text only, but needs the longer output budget. */
  COMPOSE_MODEL: z.string().min(1).default('openai/gpt-oss-120b'),
  /** Groq's free tier allows 1000 output tokens per minute on qwen. Staying under it. */
  SCAN_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(256).max(32_000).default(900),
  COMPOSE_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(1_000).max(32_000).default(5_000),
  BRIEFS_DIR: z.string().min(1).default('briefs'),
  /** Applies to the model calls. Tavily has its own, narrower ceiling. */
  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().max(600_000).default(180_000),
  /** Tavily rejects anything outside 1 to 120 seconds, so it is bounded here. */
  TAVILY_TIMEOUT_SECONDS: z.coerce.number().int().min(1).max(120).default(90),
  MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
  MAX_CORROBORATING_SOURCES: z.coerce.number().int().min(1).max(20).default(6),
})

export type ModelCall = {
  readonly model: string
  readonly maxOutputTokens: number
}

export type PipelineConfig = {
  readonly llmApiKey: string
  readonly llmBaseUrl: string
  readonly tavilyApiKey: string
  readonly scan: ModelCall
  readonly compose: ModelCall
  readonly briefsDirectory: string
  readonly requestTimeoutMs: number
  readonly tavilyTimeoutSeconds: number
  readonly maxRetries: number
  readonly maxCorroboratingSources: number
}

/** Reads configuration once at startup so a missing key fails before any network call. */
export function readPipelineConfig(environment: NodeJS.ProcessEnv): PipelineConfig {
  const parsed = environmentSchema.safeParse(environment)
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ')
    throw new ConfigurationError(`Pipeline environment is incomplete — ${problems}`)
  }
  const environmentValues = parsed.data

  return {
    llmApiKey: environmentValues.GROQ_API_KEY,
    llmBaseUrl: environmentValues.LLM_BASE_URL,
    tavilyApiKey: environmentValues.TAVILY_API_KEY,
    scan: {
      model: environmentValues.SCAN_MODEL,
      maxOutputTokens: environmentValues.SCAN_MAX_OUTPUT_TOKENS,
    },
    compose: {
      model: environmentValues.COMPOSE_MODEL,
      maxOutputTokens: environmentValues.COMPOSE_MAX_OUTPUT_TOKENS,
    },
    briefsDirectory: environmentValues.BRIEFS_DIR,
    requestTimeoutMs: environmentValues.REQUEST_TIMEOUT_MS,
    tavilyTimeoutSeconds: environmentValues.TAVILY_TIMEOUT_SECONDS,
    maxRetries: environmentValues.MAX_RETRIES,
    maxCorroboratingSources: environmentValues.MAX_CORROBORATING_SOURCES,
  }
}
