// update-vector.ts -- Recalculate user profile embedding from interaction history
// Deps: @/lib/db/server | Used by: cron job, post-save hook, recommendation engine
// Why: builds a "taste profile" vector (like Spotify) from weighted paper embeddings

import { createServiceClient } from '@/lib/db/server'

// === WEIGHTS ===

/**
 * Interaction weights for profile vector calculation.
 * Higher weight = stronger signal of user interest.
 *
 * Saved papers are the strongest signal because the user explicitly chose to bookmark.
 * Clicks imply interest (user opened the paper). Views are the weakest signal.
 */
const WEIGHT_SAVE = 3
const WEIGHT_CLICK = 2
const WEIGHT_VIEW = 1

/** Embedding dimension for text-embedding-3-small */
const EMBEDDING_DIM = 1536

// === TYPES ===

interface WeightedPaper {
  embedding: number[]
  weight: number
}

// === MAIN LOGIC ===

/**
 * Recalculate a user's profile embedding.
 *
 * The profile vector is the weighted average of embeddings from:
 * - Saved papers (weight: 3)
 * - Clicked papers (weight: 2)
 * - Viewed papers (weight: 1)
 *
 * This creates a "taste profile" similar to how Spotify builds music taste profiles.
 * The vector is normalized to unit length for consistent cosine similarity comparisons.
 */
export async function updateProfileEmbedding(userId: string): Promise<void> {
  const supabase = createServiceClient()

  // 1. Gather paper IDs from each interaction type
  const [savedResult, clickedResult, viewedResult] = await Promise.all([
    // Saved papers -- strongest signal
    supabase
      .from('saved_papers')
      .select('paper_id')
      .eq('user_id', userId),

    // Clicked papers -- medium signal
    supabase
      .from('user_interactions')
      .select('paper_id')
      .eq('user_id', userId)
      .eq('interaction_type', 'click'),

    // Viewed papers -- weakest signal
    supabase
      .from('user_interactions')
      .select('paper_id')
      .eq('user_id', userId)
      .eq('interaction_type', 'view'),
  ])

  const savedPaperIds = [...new Set((savedResult.data ?? []).map(r => r.paper_id))]
  const clickedPaperIds = [...new Set((clickedResult.data ?? []).map(r => r.paper_id))]
  const viewedPaperIds = [...new Set((viewedResult.data ?? []).map(r => r.paper_id))]

  // Collect all unique paper IDs to fetch embeddings in one query
  const allPaperIds = [...new Set([...savedPaperIds, ...clickedPaperIds, ...viewedPaperIds])]

  if (allPaperIds.length === 0) return

  // 2. Fetch embeddings for all interacted papers
  const { data: papers } = await supabase
    .from('papers')
    .select('id, embedding')
    .in('id', allPaperIds)
    .not('embedding', 'is', null)

  if (!papers || papers.length === 0) return

  // Build a lookup map: paper_id -> embedding
  const embeddingMap = new Map<string, number[]>()
  for (const paper of papers) {
    const emb = paper.embedding as number[] | null
    if (emb && emb.length === EMBEDDING_DIM) {
      embeddingMap.set(paper.id, emb)
    }
  }

  if (embeddingMap.size === 0) return

  // 3. Build weighted embedding list
  // Use sets for deduplication: if a paper is both saved and clicked, use max weight only
  const paperWeights = new Map<string, number>()

  for (const id of savedPaperIds) {
    paperWeights.set(id, Math.max(paperWeights.get(id) ?? 0, WEIGHT_SAVE))
  }
  for (const id of clickedPaperIds) {
    paperWeights.set(id, Math.max(paperWeights.get(id) ?? 0, WEIGHT_CLICK))
  }
  for (const id of viewedPaperIds) {
    paperWeights.set(id, Math.max(paperWeights.get(id) ?? 0, WEIGHT_VIEW))
  }

  const weightedPapers: WeightedPaper[] = []
  for (const [paperId, weight] of paperWeights) {
    const embedding = embeddingMap.get(paperId)
    if (embedding) {
      weightedPapers.push({ embedding, weight })
    }
  }

  if (weightedPapers.length === 0) return

  // 4. Compute weighted average of embeddings
  const totalWeight = weightedPapers.reduce((sum, wp) => sum + wp.weight, 0)
  const avgEmbedding = new Array<number>(EMBEDDING_DIM).fill(0)

  for (const { embedding, weight } of weightedPapers) {
    for (let i = 0; i < EMBEDDING_DIM; i++) {
      avgEmbedding[i] += embedding[i] * weight / totalWeight
    }
  }

  // 5. Normalize to unit vector for cosine similarity comparisons
  const magnitude = Math.sqrt(
    avgEmbedding.reduce((sum, val) => sum + val * val, 0)
  )

  if (magnitude === 0) return

  for (let i = 0; i < EMBEDDING_DIM; i++) {
    avgEmbedding[i] /= magnitude
  }

  // 6. Update profile with new embedding
  // profile_embedding is a vector(1536) column -- Supabase accepts JSON array
  await supabase
    .from('profiles')
    .update({ profile_embedding: JSON.stringify(avgEmbedding) })
    .eq('id', userId)
}
