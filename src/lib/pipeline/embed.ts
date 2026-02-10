// embed.ts — Generate vector embeddings for enriched papers
// Deps: ai, @/lib/ai, @/lib/db/server | Used by: pipeline orchestrator, API routes
// Uses OpenAI text-embedding-3-small (1536 dims) via Vercel AI SDK

import { createServiceClient } from '@/lib/db/server'
import { embed, embedMany } from 'ai'
import { embeddingModel } from '@/lib/ai'
import { chunked } from './utils'

// === CONSTANTS ===

const BATCH_SIZE = 20 // OpenAI embedMany supports batched requests

// === SINGLE PAPER EMBEDDING ===

/**
 * Generate and store an embedding for a single paper.
 * Uses tldr_rich as input text — it's keyword-dense, optimized for semantic search.
 * Skips papers that are already embedded or not yet enriched.
 */
export async function embedPaper(paperId: string): Promise<void> {
  const supabase = createServiceClient()

  // Fetch paper
  const { data: paper, error: fetchError } = await supabase
    .from('papers')
    .select('id, title, tldr_rich, embedded_at, enriched_at')
    .eq('id', paperId)
    .single()

  if (fetchError || !paper) {
    console.error(`[embed] Failed to fetch paper ${paperId}:`, fetchError?.message)
    return
  }

  // Skip if already embedded
  if (paper.embedded_at) {
    console.log(`[embed] Paper "${paper.title}" already embedded, skipping`)
    return
  }

  // Skip if not enriched (tldr_rich is required for embedding)
  if (!paper.tldr_rich) {
    console.log(`[embed] Paper "${paper.title}" not enriched yet (no tldr_rich), skipping`)
    return
  }

  // Generate embedding
  try {
    const { embedding } = await embed({
      model: embeddingModel,
      value: paper.tldr_rich,
    })

    // Store embedding and mark as embedded
    const { error: updateError } = await supabase
      .from('papers')
      .update({
        embedding: JSON.stringify(embedding),
        embedded_at: new Date().toISOString(),
      })
      .eq('id', paperId)

    if (updateError) {
      console.error(`[embed] Failed to update paper ${paperId}:`, updateError.message)
      return
    }

    console.log(`[embed] Embedded paper "${paper.title}"`)
  } catch (err) {
    console.error(`[embed] Embedding generation failed for "${paper.title}":`, err)
  }
}

// === BATCH EMBEDDING ===

/**
 * Embed all enriched papers that haven't been embedded yet.
 * Processes in batches of BATCH_SIZE using embedMany for efficiency.
 * Returns count of successfully embedded and failed papers.
 */
export async function embedBatch(
  limit = 50
): Promise<{ embedded: number; failed: number }> {
  const supabase = createServiceClient()
  let embedded = 0
  let failed = 0

  // Fetch enriched papers that need embedding
  const { data: papers, error: fetchError } = await supabase
    .from('papers')
    .select('id, title, tldr_rich')
    .is('embedded_at', null)
    .not('enriched_at', 'is', null)
    .order('published_at', { ascending: false })
    .limit(limit)

  if (fetchError) {
    console.error('[embed] Failed to fetch papers for embedding:', fetchError.message)
    return { embedded, failed }
  }

  if (!papers || papers.length === 0) {
    console.log('[embed] No papers to embed')
    return { embedded, failed }
  }

  console.log(`[embed] Found ${papers.length} papers to embed`)

  // Process in batches
  const batches = chunked(papers, BATCH_SIZE)

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx]
    console.log(
      `[embed] Processing batch ${batchIdx + 1}/${batches.length} (${batch.length} papers)`
    )

    // Filter out papers without tldr_rich (shouldn't happen given the query, but be safe)
    const validPapers = batch.filter((p) => p.tldr_rich)
    if (validPapers.length === 0) {
      console.log(`[embed] Batch ${batchIdx + 1}: no valid papers (missing tldr_rich)`)
      failed += batch.length
      continue
    }

    try {
      // Generate embeddings for the batch
      const { embeddings } = await embedMany({
        model: embeddingModel,
        values: validPapers.map((p) => p.tldr_rich!),
      })

      // Update each paper with its embedding
      for (let i = 0; i < validPapers.length; i++) {
        const paper = validPapers[i]
        const paperEmbedding = embeddings[i]

        const { error: updateError } = await supabase
          .from('papers')
          .update({
            embedding: JSON.stringify(paperEmbedding),
            embedded_at: new Date().toISOString(),
          })
          .eq('id', paper.id)

        if (updateError) {
          console.error(
            `[embed] Failed to update paper "${paper.title}":`,
            updateError.message
          )
          failed++
        } else {
          embedded++
        }
      }

      // Count papers that were filtered out as failed
      failed += batch.length - validPapers.length

      console.log(
        `[embed] Batch ${batchIdx + 1} complete: ${validPapers.length} embedded`
      )
    } catch (err) {
      console.error(`[embed] Batch ${batchIdx + 1} embedding failed:`, err)
      failed += batch.length
    }
  }

  console.log(
    `[embed] Done. Embedded: ${embedded}, Failed: ${failed}`
  )
  return { embedded, failed }
}
