// ai/index.ts — AI client setup using Vercel AI SDK
// Deps: @ai-sdk/anthropic, @ai-sdk/openai | Used by: pipeline scoring, summarization, embeddings

import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'

// === PROVIDERS ===

export const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// === MODEL SHORTCUTS ===

/** Fast + cheap — for classification, filtering, simple extraction */
export const haiku = anthropic('claude-haiku-4-5-20251001')

/** Balanced — for summarization, scoring, complex extraction */
export const sonnet = anthropic('claude-sonnet-4-5-20250929')

/** Embeddings for semantic search and similarity */
export const embeddingModel = openai.embedding('text-embedding-3-small')
