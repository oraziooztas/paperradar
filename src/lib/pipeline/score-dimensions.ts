// score-dimensions.ts — Pure scoring functions for the Research Gravity Engine.
//
// Functional core: zero I/O (no DB, no AI, no env), so every dimension is
// deterministic and unit-testable without mocks. The imperative shell lives
// in score.ts, which fetches the data, runs the AI-based novelty score, and
// persists results.
//
// Why the split: score.ts imports @/lib/db/server (which pulls in
// next/headers) and @/lib/ai — neither is importable in a plain Node/test
// runtime. Keeping the math here lets the test suite exercise it directly.

import type { Paper, GravityBreakdown } from '@/types/database'

// === TYPES ===

export interface ScoredPaperSignals {
  source: string
  score: number
  comments: number
}

export interface AuthorWithMeta {
  name: string
  h_index?: number
  affiliations?: string[]
}

// === WEIGHTS ===

export const WEIGHTS: Record<keyof GravityBreakdown, number> = {
  novelty: 0.25,
  social_buzz: 0.2,
  builder_relevance: 0.2,
  citation_velocity: 0.15,
  author_reputation: 0.1,
  technical_depth: 0.1,
}

// === TOP LABS FOR AFFILIATION BOOST ===

export const TOP_LABS = [
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

// === HELPERS ===

/** Clamp a number to an integer in [0, 100]. */
export function clamp(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)))
}

// === INDIVIDUAL SCORERS (pure) ===

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
export function scoreSocialBuzz(signals: ScoredPaperSignals[]): number {
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
export function scoreBuilderRelevance(paper: Paper): number {
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
export function scoreCitationVelocity(citationCount: number, daysSincePublished: number): number {
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
export function scoreAuthorReputation(authors: AuthorWithMeta[]): number {
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
export function scoreTechnicalDepth(paper: Paper): number {
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

// === FINAL COMBINATION ===

/**
 * Combine the six dimension scores into the final 0-100 Gravity Score using
 * the fixed WEIGHTS, then clamp. Pure: identical input always maps to the
 * same output.
 */
export function computeGravityScore(breakdown: Required<GravityBreakdown>): number {
  return clamp(
    breakdown.novelty * WEIGHTS.novelty +
      breakdown.social_buzz * WEIGHTS.social_buzz +
      breakdown.builder_relevance * WEIGHTS.builder_relevance +
      breakdown.citation_velocity * WEIGHTS.citation_velocity +
      breakdown.author_reputation * WEIGHTS.author_reputation +
      breakdown.technical_depth * WEIGHTS.technical_depth
  )
}
