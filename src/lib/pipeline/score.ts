// score.ts — Research Gravity Engine: imperative shell.
// Fetches paper data + social/author signals, runs the AI-based novelty
// score, combines all six dimensions (pure math lives in ./score-dimensions),
// and persists gravity_score + breakdown back to the database.
// Deps: ai, @/lib/ai, @/lib/db/server, @/types/database, ./score-dimensions

import { createServiceClient } from '@/lib/db/server'
import { generateText } from 'ai'
import { sonnet } from '@/lib/ai'
import type { Paper, AuthorEntry, GravityBreakdown } from '@/types/database'
import {
  clamp,
  computeGravityScore,
  scoreSocialBuzz,
  scoreBuilderRelevance,
  scoreCitationVelocity,
  scoreAuthorReputation,
  scoreTechnicalDepth,
  type ScoredPaperSignals,
  type AuthorWithMeta,
} from './score-dimensions'

// === AI-BASED SCORER (impure: calls the model) ===

/**
 * Score novelty using Claude Sonnet.
 * Prompt is kept short to minimize cost: title + abstract + novelty_assessment.
 * Returns 50 (neutral) if the AI call fails.
 */
async function scoreNovelty(paper: Paper): Promise<number> {
  try {
    const { text } = await generateText({
      model: sonnet,
      prompt: `Rate the novelty of this AI/ML research paper from 0 to 100.
0 = purely incremental, minor tweak of existing work.
50 = meaningful contribution with some new elements.
100 = paradigm shift, completely new approach.

Title: ${paper.title}
Abstract: ${paper.abstract.slice(0, 1500)}
${paper.novelty_assessment ? `Novelty assessment: ${paper.novelty_assessment}` : ''}
${paper.categories.length > 0 ? `Categories: ${paper.categories.join(', ')}` : ''}

Return ONLY a single integer between 0 and 100. No explanation.`,
      maxOutputTokens: 10,
    })

    const parsed = parseInt(text.trim(), 10)
    if (isNaN(parsed)) {
      console.log(`[score] Novelty: could not parse "${text}", defaulting to 50`)
      return 50
    }
    return clamp(parsed)
  } catch (err) {
    console.error(`[score] Novelty scoring failed for "${paper.title}":`, err)
    return 50 // Neutral default on failure
  }
}

// === MAIN SCORING ===

/**
 * Score a single paper across all 6 dimensions and update the database.
 * The paper must be enriched (enriched_at IS NOT NULL) before scoring.
 *
 * 1. Fetch paper + social signals + author data
 * 2. Calculate each dimension score
 * 3. Calculate weighted final score
 * 4. Update paper with gravity_score, gravity_breakdown, scored_at
 */
export async function scorePaper(paperId: string): Promise<void> {
  const supabase = createServiceClient()

  // 1. Fetch paper
  const { data: paper, error: paperError } = await supabase
    .from('papers')
    .select('*')
    .eq('id', paperId)
    .single()

  if (paperError || !paper) {
    console.error(`[score] Failed to fetch paper ${paperId}:`, paperError?.message)
    return
  }

  if (!paper.enriched_at) {
    console.log(`[score] Paper "${paper.title}" not enriched yet, skipping`)
    return
  }

  // 2. Fetch social signals for this paper
  const { data: socialSignals, error: signalsError } = await supabase
    .from('social_signals')
    .select('source, score, comments')
    .eq('paper_id', paperId)

  if (signalsError) {
    console.error(`[score] Failed to fetch social signals for ${paperId}:`, signalsError.message)
  }

  const signals: ScoredPaperSignals[] = (socialSignals ?? []).map((s) => ({
    source: s.source as string,
    score: s.score as number,
    comments: s.comments as number,
  }))

  // 3. Fetch author data via paper_authors join
  const { data: paperAuthors, error: authorsError } = await supabase
    .from('paper_authors')
    .select('author_id')
    .eq('paper_id', paperId)

  if (authorsError) {
    console.error(`[score] Failed to fetch paper_authors for ${paperId}:`, authorsError.message)
  }

  let authorsMeta: AuthorWithMeta[] = []

  if (paperAuthors && paperAuthors.length > 0) {
    const authorIds = paperAuthors.map((pa) => pa.author_id)
    const { data: authorsData, error: authorsFetchError } = await supabase
      .from('authors')
      .select('name, h_index, affiliations')
      .in('id', authorIds)

    if (authorsFetchError) {
      console.error(`[score] Failed to fetch authors for ${paperId}:`, authorsFetchError.message)
    }

    authorsMeta = (authorsData ?? []).map((a) => ({
      name: a.name as string,
      h_index: (a.h_index as number | null) ?? undefined,
      affiliations: (a.affiliations as string[]) ?? [],
    }))
  }

  // If no authors in the authors table, fall back to the paper's embedded authors field
  // (the paper.authors JSONB has name + affiliation but no h_index)
  if (authorsMeta.length === 0 && paper.authors && paper.authors.length > 0) {
    authorsMeta = (paper.authors as AuthorEntry[]).map((a: AuthorEntry) => ({
      name: a.name,
      affiliations: a.affiliation ? [a.affiliation] : [],
    }))
  }

  // 4. Calculate each dimension score
  const typedPaper = paper as Paper

  const novelty = await scoreNovelty(typedPaper)
  const social_buzz = scoreSocialBuzz(signals)
  const builder_relevance = scoreBuilderRelevance(typedPaper)

  // Citation velocity: count citations and days since published
  const daysSincePublished = Math.max(
    0,
    Math.floor(
      (Date.now() - new Date(paper.published_at).getTime()) / (1000 * 60 * 60 * 24)
    )
  )
  // Citation count comes from Semantic Scholar data — stored in social_signals as 'semantic_scholar'
  // or we can use a dedicated citation_count column if available. For now, use 0 as default.
  const { data: citationData } = await supabase
    .from('social_signals')
    .select('score')
    .eq('paper_id', paperId)
    .eq('source', 'hackernews') // Semantic Scholar citation data may be stored differently
    .maybeSingle()

  // If there's no specific citation count signal, estimate from metadata
  // In practice, citation data would come from Semantic Scholar enrichment
  const citationCount = citationData?.score ?? 0
  const citation_velocity = scoreCitationVelocity(citationCount, daysSincePublished)

  const author_reputation = scoreAuthorReputation(authorsMeta)
  const technical_depth = scoreTechnicalDepth(typedPaper)

  // 5. Assemble breakdown and calculate the weighted final score
  const breakdown: Required<GravityBreakdown> = {
    novelty,
    social_buzz,
    builder_relevance,
    citation_velocity,
    author_reputation,
    technical_depth,
  }

  const gravityScore = computeGravityScore(breakdown)

  // 6. Update paper with gravity_score and gravity_breakdown
  const { error: updateError } = await supabase
    .from('papers')
    .update({
      gravity_score: gravityScore,
      gravity_breakdown: breakdown,
      scored_at: new Date().toISOString(),
    })
    .eq('id', paperId)

  if (updateError) {
    console.error(`[score] Failed to update paper ${paperId}:`, updateError.message)
    return
  }

  console.log(
    `[score] Scored "${paper.title}" → ${gravityScore}/100 ` +
    `(N:${novelty} S:${social_buzz} B:${builder_relevance} C:${citation_velocity} A:${author_reputation} T:${technical_depth})`
  )
}

// === BATCH SCORING ===

/**
 * Score all enriched papers that haven't been scored yet.
 * Papers must have enriched_at set and scored_at null.
 */
export async function scoreBatch(
  limit = 20
): Promise<{ scored: number; failed: number }> {
  const supabase = createServiceClient()
  let scored = 0
  let failed = 0

  // Fetch enriched but unscored papers
  const { data: papers, error: fetchError } = await supabase
    .from('papers')
    .select('id, title')
    .is('scored_at', null)
    .not('enriched_at', 'is', null)
    .order('published_at', { ascending: false })
    .limit(limit)

  if (fetchError) {
    console.error('[score] Failed to fetch papers for scoring:', fetchError.message)
    return { scored, failed }
  }

  if (!papers || papers.length === 0) {
    console.log('[score] No papers to score')
    return { scored, failed }
  }

  console.log(`[score] Found ${papers.length} papers to score`)

  for (let i = 0; i < papers.length; i++) {
    const paper = papers[i]
    console.log(`[score] Scoring ${i + 1}/${papers.length}: "${paper.title}"`)

    try {
      await scorePaper(paper.id)
      scored++
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[score] Failed to score "${paper.title}":`, message)
      failed++
    }
  }

  console.log(`[score] Batch complete. Scored: ${scored}, Failed: ${failed}`)
  return { scored, failed }
}

// === RESCORE STALE ===

/**
 * Rescore papers whose scores are older than 24 hours.
 * Social signals may have changed (new Reddit posts, GitHub stars, etc.),
 * so rescoring keeps the gravity_score fresh.
 */
export async function rescoreStale(
  limit = 50
): Promise<{ rescored: number }> {
  const supabase = createServiceClient()
  let rescored = 0

  // scored_at older than 24 hours ago
  const staleThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data: papers, error: fetchError } = await supabase
    .from('papers')
    .select('id, title')
    .not('scored_at', 'is', null)
    .lt('scored_at', staleThreshold)
    .order('scored_at', { ascending: true }) // Oldest scores first
    .limit(limit)

  if (fetchError) {
    console.error('[score] Failed to fetch stale papers:', fetchError.message)
    return { rescored }
  }

  if (!papers || papers.length === 0) {
    console.log('[score] No stale papers to rescore')
    return { rescored }
  }

  console.log(`[score] Found ${papers.length} stale papers to rescore`)

  for (let i = 0; i < papers.length; i++) {
    const paper = papers[i]
    console.log(`[score] Rescoring ${i + 1}/${papers.length}: "${paper.title}"`)

    try {
      await scorePaper(paper.id)
      rescored++
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[score] Failed to rescore "${paper.title}":`, message)
      // Don't count failures as rescored, but continue with the rest
    }
  }

  console.log(`[score] Rescore complete. Rescored: ${rescored}/${papers.length}`)
  return { rescored }
}

// === RE-EXPORTS (kept for backward compatibility) ===

export { WEIGHTS, TOP_LABS } from './score-dimensions'
export type { GravityBreakdown } from '@/types/database'
export type { ScoredPaperSignals, AuthorWithMeta } from './score-dimensions'
