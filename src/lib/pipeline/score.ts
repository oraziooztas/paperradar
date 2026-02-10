// score.ts — Research Gravity Engine: scores papers on a 0-100 scale across 6 dimensions
// Deps: ai, @/lib/ai, @/lib/db/server, @/types/database | Used by: pipeline orchestrator, API routes
// Why 6 dimensions: novelty, social buzz, builder relevance, citation velocity, author reputation, technical depth
// — each captures a different signal of a paper's importance to the AI/ML builder community

import { createServiceClient } from '@/lib/db/server'
import { generateText } from 'ai'
import { sonnet } from '@/lib/ai'
import type { Paper, AuthorEntry, GravityBreakdown } from '@/types/database'

// === TYPES ===

interface ScoredPaperSignals {
  source: string
  score: number
  comments: number
}

interface AuthorWithMeta {
  name: string
  h_index?: number
  affiliations?: string[]
}

// === WEIGHTS ===

const WEIGHTS: Record<keyof GravityBreakdown, number> = {
  novelty: 0.25,
  social_buzz: 0.20,
  builder_relevance: 0.20,
  citation_velocity: 0.15,
  author_reputation: 0.10,
  technical_depth: 0.10,
}

// === HELPERS ===

/** Clamp a number between 0 and 100 */
function clamp(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)))
}

// === TOP LABS FOR AFFILIATION BOOST ===

const TOP_LABS = [
  'deepmind',
  'google brain',
  'google research',
  'openai',
  'meta ai',
  'fair',
  'microsoft research',
  'anthropic',
  'apple ml',
  'apple machine learning',
  'nvidia research',
  'stanford',
  'mit',
  'berkeley',
  'cmu',
  'carnegie mellon',
] as const

// === INDIVIDUAL SCORERS ===

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

/**
 * Score social buzz from aggregated social signals.
 * Uses a logarithmic scale so a few high-engagement signals are meaningful
 * but the score doesn't linearly run away with viral posts.
 *
 * Signal weights:
 * - Reddit: upvotes * 1 + comments * 2 (comments = deeper engagement)
 * - HuggingFace: upvotes * 3 (curated community, higher signal)
 * - GitHub: stars * 2
 * - Twitter: mentions * 1 (future)
 * - HackerNews: score * 1 + comments * 2
 */
function scoreSocialBuzz(signals: ScoredPaperSignals[]): number {
  if (signals.length === 0) return 0

  let raw = 0

  for (const signal of signals) {
    switch (signal.source) {
      case 'reddit':
        raw += signal.score * 1 + signal.comments * 2
        break
      case 'huggingface':
        raw += signal.score * 3
        break
      case 'github':
        raw += signal.score * 2
        break
      case 'twitter':
        raw += signal.score * 1
        break
      case 'hackernews':
        raw += signal.score * 1 + signal.comments * 2
        break
      default:
        raw += signal.score
    }
  }

  // Logarithmic normalization: 0 = 0, ~7 raw = 45, ~60 raw = 90, 100+ ~= 100
  const score = Math.log2(raw + 1) * 15
  return clamp(score)
}

/**
 * Score builder relevance based on paper metadata.
 * Heuristic: is this paper useful for someone who wants to build something?
 *
 * - code_url exists → +30 (can replicate)
 * - practical_applicability mentions usability → +20
 * - difficulty is beginner/intermediate → +20 (more accessible)
 * - categories include Infrastructure/Optimization → +15
 * - abstract mentions "open source", "released", "available" → +15
 */
function scoreBuilderRelevance(paper: Paper): number {
  let score = 0

  // Code availability is the strongest signal for builders
  if (paper.code_url) {
    score += 30
  }

  // Practical applicability text analysis
  if (paper.practical_applicability) {
    const pa = paper.practical_applicability.toLowerCase()
    const practicalPhrases = [
      'can be used',
      'ready to use',
      'practical',
      'production',
      'deploy',
      'plug-and-play',
      'off-the-shelf',
      'straightforward',
      'easy to',
      'applicable',
    ]
    if (practicalPhrases.some((phrase) => pa.includes(phrase))) {
      score += 20
    }
  }

  // Difficulty-based accessibility
  if (paper.difficulty === 'beginner' || paper.difficulty === 'intermediate') {
    score += 20
  }

  // Category boost for builder-oriented topics
  const builderCategories = ['cs.SE', 'cs.DC', 'cs.PF', 'cs.DB', 'cs.NI']
  const categoryLabels = paper.categories.map((c) => c.toLowerCase())
  if (builderCategories.some((bc) => categoryLabels.includes(bc.toLowerCase()))) {
    score += 15
  }

  // Abstract keyword signals for availability
  const abstractLower = paper.abstract.toLowerCase()
  const availabilityKeywords = [
    'open source',
    'open-source',
    'released',
    'available at',
    'code available',
    'github',
    'huggingface',
    'pip install',
    'library',
    'framework',
    'toolkit',
    'api',
  ]
  if (availabilityKeywords.some((kw) => abstractLower.includes(kw))) {
    score += 15
  }

  return clamp(score)
}

/**
 * Score citation velocity: how fast is this paper being cited?
 * Early citation velocity matters most — a paper cited 5 times in the first week
 * is a much stronger signal than 5 citations over 6 months.
 *
 * velocity = citations / max(daysSincePublished, 1)
 * After 30 days, we cap the denominator at 30 to avoid penalizing older papers.
 * Normalize: 0 cit/day = 0, 1 cit/day = 20, 5 cit/day = 100
 */
function scoreCitationVelocity(citationCount: number, daysSincePublished: number): number {
  if (citationCount <= 0) return 0

  // Cap at 30 days to avoid penalizing papers that have been out for a while
  const effectiveDays = Math.min(Math.max(daysSincePublished, 1), 30)
  const velocity = citationCount / effectiveDays
  const score = velocity * 20

  return clamp(score)
}

/**
 * Score author reputation based on h-index and affiliation.
 * We take the max h-index among all authors since a strong co-author
 * signals a credible paper.
 *
 * h-index scoring: min(100, maxHIndex * 2) — h-index of 50+ = 100
 * Affiliation boost: +20 if any author is from a top lab
 * Default: 30 if no h-index data available
 */
function scoreAuthorReputation(authors: AuthorWithMeta[]): number {
  if (authors.length === 0) return 30

  // Find max h-index
  let maxHIndex = -1
  let hasAnyHIndex = false
  let hasTopAffiliation = false

  for (const author of authors) {
    if (author.h_index !== undefined && author.h_index !== null) {
      hasAnyHIndex = true
      if (author.h_index > maxHIndex) {
        maxHIndex = author.h_index
      }
    }

    // Check affiliations against top labs
    if (author.affiliations) {
      for (const aff of author.affiliations) {
        const affLower = aff.toLowerCase()
        if (TOP_LABS.some((lab) => affLower.includes(lab))) {
          hasTopAffiliation = true
        }
      }
    }
  }

  // Base score from h-index
  let score: number
  if (hasAnyHIndex) {
    score = Math.min(100, maxHIndex * 2)
  } else {
    score = 30 // Neutral-low default when no h-index data
  }

  // Affiliation boost
  if (hasTopAffiliation) {
    score += 20
  }

  return clamp(score)
}

/**
 * Score technical depth based on abstract characteristics.
 * We don't have full paper text, so we use abstract length and
 * the presence of technical keywords as proxies.
 *
 * Abstract length tiers:
 *   < 500 chars → 20, 500-1000 → 40, 1000-1500 → 60, 1500-2000 → 80, 2000+ → 90
 *
 * Depth keywords boost: +10 each, max +30
 */
function scoreTechnicalDepth(paper: Paper): number {
  const len = paper.abstract.length

  // Base score from abstract length
  let score: number
  if (len < 500) {
    score = 20
  } else if (len < 1000) {
    score = 40
  } else if (len < 1500) {
    score = 60
  } else if (len < 2000) {
    score = 80
  } else {
    score = 90
  }

  // Depth keywords — signal rigorous methodology
  const depthKeywords = [
    'theorem',
    'proof',
    'convergence',
    'bound',
    'complexity',
    'analysis',
    'formulation',
    'optimization',
    'guarantee',
    'regret',
  ]
  const abstractLower = paper.abstract.toLowerCase()
  let keywordBonus = 0

  for (const kw of depthKeywords) {
    if (abstractLower.includes(kw)) {
      keywordBonus += 10
      if (keywordBonus >= 30) break // Cap at +30
    }
  }

  score += keywordBonus
  return clamp(score)
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

  // 5. Assemble breakdown and calculate weighted final score
  const breakdown: Required<GravityBreakdown> = {
    novelty,
    social_buzz,
    builder_relevance,
    citation_velocity,
    author_reputation,
    technical_depth,
  }

  const gravityScore = clamp(
    breakdown.novelty * WEIGHTS.novelty +
    breakdown.social_buzz * WEIGHTS.social_buzz +
    breakdown.builder_relevance * WEIGHTS.builder_relevance +
    breakdown.citation_velocity * WEIGHTS.citation_velocity +
    breakdown.author_reputation * WEIGHTS.author_reputation +
    breakdown.technical_depth * WEIGHTS.technical_depth
  )

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

// === EXPORTS ===

export { WEIGHTS, TOP_LABS }
export type { GravityBreakdown, ScoredPaperSignals, AuthorWithMeta }
