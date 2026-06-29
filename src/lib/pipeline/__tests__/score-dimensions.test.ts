import { describe, it, expect } from 'vitest'
import type { Paper } from '@/types/database'
import {
  clamp,
  WEIGHTS,
  TOP_LABS,
  scoreSocialBuzz,
  scoreBuilderRelevance,
  scoreCitationVelocity,
  scoreAuthorReputation,
  scoreTechnicalDepth,
  computeGravityScore,
  type ScoredPaperSignals,
  type AuthorWithMeta,
} from '@/lib/pipeline/score-dimensions'

// A neutral, fully-typed paper that triggers no scoring bonuses by default.
// Tests override only the fields they exercise.
function makePaper(overrides: Partial<Paper> = {}): Paper {
  return {
    id: 'paper-1',
    arxiv_id: '2401.00001',
    title: 'A Neutral Paper',
    authors: [],
    abstract: 'a short neutral summary about widgets',
    tldr: null,
    tldr_rich: null,
    key_findings: [],
    novelty_assessment: null,
    practical_applicability: null,
    categories: [],
    difficulty: 'advanced',
    gravity_score: 0,
    gravity_breakdown: {},
    embedding: null,
    source_url: null,
    pdf_url: null,
    code_url: null,
    published_at: '2024-01-01T00:00:00Z',
    enriched_at: null,
    embedded_at: null,
    scored_at: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

function signal(
  source: string,
  score: number,
  comments = 0
): ScoredPaperSignals {
  return { source, score, comments }
}

describe('clamp', () => {
  it('floors below 0 and caps above 100', () => {
    expect(clamp(-5)).toBe(0)
    expect(clamp(150)).toBe(100)
  })

  it('rounds to the nearest integer', () => {
    expect(clamp(50.4)).toBe(50)
    expect(clamp(50.5)).toBe(51)
    expect(clamp(99.6)).toBe(100)
  })

  it('keeps the boundary values', () => {
    expect(clamp(0)).toBe(0)
    expect(clamp(100)).toBe(100)
  })
})

describe('scoreSocialBuzz', () => {
  it('returns 0 with no signals', () => {
    expect(scoreSocialBuzz([])).toBe(0)
  })

  it('applies the logarithmic curve at clean powers of two', () => {
    // raw = 2^k - 1  ->  log2(raw + 1) * 15 = k * 15
    expect(scoreSocialBuzz([signal('reddit', 1, 0)])).toBe(15) // raw 1
    expect(scoreSocialBuzz([signal('reddit', 3, 0)])).toBe(30) // raw 3
    expect(scoreSocialBuzz([signal('reddit', 7, 0)])).toBe(45) // raw 7
  })

  it('weights reddit comments x2', () => {
    // raw = 1*1 + 3*2 = 7 -> 45
    expect(scoreSocialBuzz([signal('reddit', 1, 3)])).toBe(45)
  })

  it('weights huggingface upvotes x3', () => {
    // raw = 1*3 = 3 -> 30
    expect(scoreSocialBuzz([signal('huggingface', 1, 0)])).toBe(30)
  })

  it('weights hackernews as score + comments x2', () => {
    // raw = 1 + 3*2 = 7 -> 45
    expect(scoreSocialBuzz([signal('hackernews', 1, 3)])).toBe(45)
  })

  it('ignores comments for twitter and unknown sources', () => {
    expect(scoreSocialBuzz([signal('twitter', 7, 999)])).toBe(45) // raw 7
    expect(scoreSocialBuzz([signal('mystery-source', 7, 999)])).toBe(45) // default: raw 7
  })

  it('sums raw signals across sources', () => {
    // github 4*2 = 8, reddit 7*1 = 7 -> raw 15 -> log2(16)*15 = 60
    expect(scoreSocialBuzz([signal('github', 4, 0), signal('reddit', 7, 0)])).toBe(60)
  })

  it('rewards the curated huggingface source over reddit for equal raw score', () => {
    expect(scoreSocialBuzz([signal('huggingface', 5, 0)])).toBeGreaterThan(
      scoreSocialBuzz([signal('reddit', 5, 0)])
    )
  })

  it('clamps runaway virality to 100', () => {
    expect(scoreSocialBuzz([signal('reddit', 100000, 0)])).toBe(100)
  })
})

describe('scoreBuilderRelevance', () => {
  it('scores a neutral paper at 0', () => {
    expect(scoreBuilderRelevance(makePaper())).toBe(0)
  })

  it('adds 30 for an available code_url', () => {
    expect(scoreBuilderRelevance(makePaper({ code_url: 'https://github.com/x/y' }))).toBe(30)
  })

  it('adds 20 for beginner/intermediate difficulty only', () => {
    expect(scoreBuilderRelevance(makePaper({ difficulty: 'beginner' }))).toBe(20)
    expect(scoreBuilderRelevance(makePaper({ difficulty: 'intermediate' }))).toBe(20)
    expect(scoreBuilderRelevance(makePaper({ difficulty: 'expert' }))).toBe(0)
  })

  it('adds 20 for a practical-applicability phrase', () => {
    expect(
      scoreBuilderRelevance(makePaper({ practical_applicability: 'this is production ready' }))
    ).toBe(20)
  })

  it('adds 15 for a builder-oriented category (case-insensitive)', () => {
    expect(scoreBuilderRelevance(makePaper({ categories: ['cs.SE'] }))).toBe(15)
    expect(scoreBuilderRelevance(makePaper({ categories: ['CS.dc'] }))).toBe(15)
  })

  it('adds 15 for an availability keyword in the abstract', () => {
    expect(
      scoreBuilderRelevance(makePaper({ abstract: 'we provide an open source toolkit' }))
    ).toBe(15)
  })

  it('clamps the maximum to 100 when every signal fires', () => {
    const paper = makePaper({
      code_url: 'https://github.com/x/y',
      practical_applicability: 'production ready',
      difficulty: 'beginner',
      categories: ['cs.DC'],
      abstract: 'an open source framework',
    })
    expect(scoreBuilderRelevance(paper)).toBe(100)
  })
})

describe('scoreCitationVelocity', () => {
  it('returns 0 for zero or negative citations', () => {
    expect(scoreCitationVelocity(0, 5)).toBe(0)
    expect(scoreCitationVelocity(-3, 5)).toBe(0)
  })

  it('scores 20 per citation-per-day', () => {
    expect(scoreCitationVelocity(1, 1)).toBe(20)
    expect(scoreCitationVelocity(10, 5)).toBe(40) // 2/day
    expect(scoreCitationVelocity(5, 1)).toBe(100) // 5/day
  })

  it('treats 0 days-since-published as 1 day (no divide-by-zero)', () => {
    expect(scoreCitationVelocity(3, 0)).toBe(60) // 3/day
  })

  it('caps the denominator at 30 days', () => {
    // 1 citation over 100 days -> 1/30 * 20 = 0.667 -> rounds to 1
    expect(scoreCitationVelocity(1, 100)).toBe(1)
    // 30 citations over 30 days -> 1/day -> 20
    expect(scoreCitationVelocity(30, 30)).toBe(20)
  })

  it('clamps very fast velocity to 100', () => {
    expect(scoreCitationVelocity(100, 1)).toBe(100)
  })
})

describe('scoreAuthorReputation', () => {
  it('defaults to 30 with no authors', () => {
    expect(scoreAuthorReputation([])).toBe(30)
  })

  it('defaults to 30 when no h-index data is present', () => {
    expect(scoreAuthorReputation([{ name: 'Jane Doe' }])).toBe(30)
  })

  it('scores h-index x2 and takes the max across authors', () => {
    expect(scoreAuthorReputation([{ name: 'A', h_index: 10 }])).toBe(20)
    expect(
      scoreAuthorReputation([
        { name: 'A', h_index: 5 },
        { name: 'B', h_index: 25 },
      ])
    ).toBe(50)
  })

  it('caps the h-index contribution at 100', () => {
    expect(scoreAuthorReputation([{ name: 'A', h_index: 60 }])).toBe(100)
  })

  it('adds a 20-point boost for a top-lab affiliation', () => {
    expect(
      scoreAuthorReputation([{ name: 'A', h_index: 10, affiliations: ['DeepMind London'] }])
    ).toBe(40)
    // No h-index -> base 30 + 20 boost = 50
    expect(
      scoreAuthorReputation([{ name: 'A', affiliations: ['MIT CSAIL'] }])
    ).toBe(50)
  })

  it('gives no boost for an unknown affiliation', () => {
    expect(
      scoreAuthorReputation([{ name: 'A', affiliations: ['Some Random University'] }])
    ).toBe(30)
  })

  it('clamps h-index plus affiliation boost to 100', () => {
    const authors: AuthorWithMeta[] = [{ name: 'A', h_index: 50, affiliations: ['OpenAI'] }]
    expect(scoreAuthorReputation(authors)).toBe(100)
  })
})

describe('scoreTechnicalDepth', () => {
  it('scores by abstract length tier with no keywords', () => {
    expect(scoreTechnicalDepth(makePaper({ abstract: 'x'.repeat(100) }))).toBe(20)
    expect(scoreTechnicalDepth(makePaper({ abstract: 'x'.repeat(600) }))).toBe(40)
    expect(scoreTechnicalDepth(makePaper({ abstract: 'x'.repeat(1200) }))).toBe(60)
    expect(scoreTechnicalDepth(makePaper({ abstract: 'x'.repeat(1700) }))).toBe(80)
    expect(scoreTechnicalDepth(makePaper({ abstract: 'x'.repeat(2100) }))).toBe(90)
  })

  it('adds 10 per depth keyword', () => {
    expect(scoreTechnicalDepth(makePaper({ abstract: 'theorem ' + 'x'.repeat(100) }))).toBe(30)
  })

  it('caps the keyword bonus at 30', () => {
    // base 20 + capped 30 = 50, even with four keywords present
    const abstract = 'theorem proof convergence bound ' + 'x'.repeat(100)
    expect(scoreTechnicalDepth(makePaper({ abstract }))).toBe(50)
  })

  it('clamps length plus keyword bonus to 100', () => {
    const abstract = 'theorem proof bound ' + 'x'.repeat(2100)
    expect(scoreTechnicalDepth(makePaper({ abstract }))).toBe(100)
  })
})

describe('WEIGHTS and TOP_LABS', () => {
  it('weights sum to 1', () => {
    const total = Object.values(WEIGHTS).reduce((a, b) => a + b, 0)
    expect(total).toBeCloseTo(1, 10)
  })

  it('lists the frontier labs', () => {
    expect(TOP_LABS).toContain('openai')
    expect(TOP_LABS).toContain('anthropic')
    expect(TOP_LABS).toContain('deepmind')
  })
})

describe('computeGravityScore', () => {
  const zero = {
    novelty: 0,
    social_buzz: 0,
    builder_relevance: 0,
    citation_velocity: 0,
    author_reputation: 0,
    technical_depth: 0,
  }

  it('is 0 when every dimension is 0', () => {
    expect(computeGravityScore(zero)).toBe(0)
  })

  it('is 100 when every dimension is 100', () => {
    expect(
      computeGravityScore({
        novelty: 100,
        social_buzz: 100,
        builder_relevance: 100,
        citation_velocity: 100,
        author_reputation: 100,
        technical_depth: 100,
      })
    ).toBe(100)
  })

  it('combines dimensions with the documented weights', () => {
    // 80*.25 + 60*.2 + 40*.2 + 20*.15 + 50*.1 + 70*.1
    // = 20 + 12 + 8 + 3 + 5 + 7 = 55
    expect(
      computeGravityScore({
        novelty: 80,
        social_buzz: 60,
        builder_relevance: 40,
        citation_velocity: 20,
        author_reputation: 50,
        technical_depth: 70,
      })
    ).toBe(55)
  })

  it('returns the input value when all dimensions are equal', () => {
    expect(
      computeGravityScore({
        novelty: 50,
        social_buzz: 50,
        builder_relevance: 50,
        citation_velocity: 50,
        author_reputation: 50,
        technical_depth: 50,
      })
    ).toBe(50)
  })
})
