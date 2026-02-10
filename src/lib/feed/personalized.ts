// personalized.ts -- Generate personalized and trending paper feeds
// Deps: @/lib/db/server | Used by: feed page, API routes
// Why: core feed logic combining gravity score with vector similarity for recommendations

import { createServiceClient } from '@/lib/db/server'
import type { AuthorEntry, GravityBreakdown, Difficulty } from '@/types/database'

// === TYPES ===

export interface FeedOptions {
  userId: string
  limit?: number
  offset?: number
  categories?: string[]
  difficulty?: string
  minGravityScore?: number
  timeRange?: '24h' | '7d' | '30d' | 'all'
}

export interface TrendingFeedOptions {
  limit?: number
  offset?: number
  categories?: string[]
  difficulty?: string
  timeRange?: '24h' | '7d' | '30d' | 'all'
}

export interface FeedResult {
  papers: FeedPaper[]
  total: number
  hasMore: boolean
}

export interface FeedPaper {
  id: string
  title: string
  tldr: string | null
  categories: string[]
  difficulty: Difficulty | null
  gravity_score: number
  gravity_breakdown: GravityBreakdown
  published_at: string
  authors: AuthorEntry[]
  arxiv_id: string
  code_url: string | null
  personalization_score: number
  is_saved: boolean
}

// === HELPERS ===

/** Convert a time range string to a PostgreSQL-compatible timestamptz cutoff */
function getTimeCutoff(timeRange: string | undefined): string | null {
  if (!timeRange || timeRange === 'all') return null

  const now = new Date()
  switch (timeRange) {
    case '24h':
      now.setHours(now.getHours() - 24)
      break
    case '7d':
      now.setDate(now.getDate() - 7)
      break
    case '30d':
      now.setDate(now.getDate() - 30)
      break
    default:
      return null
  }
  return now.toISOString()
}

/**
 * Build a set of saved paper IDs for the current user.
 * Returns empty set if userId is not provided.
 */
async function getSavedPaperIds(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string
): Promise<Set<string>> {
  const { data: savedPapers } = await supabase
    .from('saved_papers')
    .select('paper_id')
    .eq('user_id', userId)

  return new Set((savedPapers ?? []).map(sp => sp.paper_id))
}

// === PERSONALIZED FEED ===

/**
 * Generate a personalized feed for an authenticated user.
 *
 * Ranking strategy:
 * - If the user has a profile embedding: personalization_score = gravity_score/100 * cosine_similarity
 *   This means a paper must be both high-quality (gravity) AND relevant (similarity) to rank high.
 * - Fallback (no embedding): boost papers matching the user's followed categories,
 *   then sort by gravity_score.
 */
export async function getPersonalizedFeed(options: FeedOptions): Promise<FeedResult> {
  const {
    userId,
    limit = 20,
    offset = 0,
    categories,
    difficulty,
    minGravityScore = 0,
    timeRange,
  } = options

  const supabase = createServiceClient()

  // 1. Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('profile_embedding, categories')
    .eq('id', userId)
    .single()

  const timeCutoff = getTimeCutoff(timeRange)

  // 2. Choose ranking strategy based on whether user has a profile embedding
  if (profile?.profile_embedding) {
    return getVectorRankedFeed({
      supabase,
      userId,
      profileEmbedding: profile.profile_embedding as unknown as string,
      limit,
      offset,
      categories,
      difficulty,
      minGravityScore,
      timeCutoff,
    })
  }

  // Fallback: category-boosted gravity ranking
  return getCategoryBoostedFeed({
    supabase,
    userId,
    userCategories: profile?.categories ?? [],
    limit,
    offset,
    categories,
    difficulty,
    minGravityScore,
    timeCutoff,
  })
}

// === VECTOR-RANKED FEED (user has profile embedding) ===

interface VectorFeedParams {
  supabase: ReturnType<typeof createServiceClient>
  userId: string
  profileEmbedding: string
  limit: number
  offset: number
  categories: string[] | undefined
  difficulty: string | undefined
  minGravityScore: number
  timeCutoff: string | null
}

async function getVectorRankedFeed(params: VectorFeedParams): Promise<FeedResult> {
  const {
    supabase,
    userId,
    profileEmbedding,
    limit,
    offset,
    categories,
    difficulty,
    minGravityScore,
    timeCutoff,
  } = params

  // Use the get_personalized_feed RPC for efficient vector-ranked results
  const { data: rpcPapers, error } = await supabase.rpc('get_personalized_feed', {
    p_user_embedding: profileEmbedding,
    p_limit: limit + 1, // Fetch one extra to determine hasMore
    p_offset: offset,
    p_min_gravity: minGravityScore,
    p_categories: categories ?? null,
    p_since: timeCutoff,
  })

  if (error || !rpcPapers) {
    // Graceful degradation: fall back to gravity-only ranking
    return getCategoryBoostedFeed({
      supabase,
      userId,
      userCategories: [],
      limit,
      offset,
      categories,
      difficulty,
      minGravityScore,
      timeCutoff,
    })
  }

  // Apply difficulty filter client-side (simpler than adding to RPC)
  let filtered = rpcPapers as RpcPaperRow[]
  if (difficulty) {
    filtered = filtered.filter(p => p.difficulty === difficulty)
  }

  const hasMore = filtered.length > limit
  const sliced = filtered.slice(0, limit)

  // Get saved paper IDs for is_saved flag
  const savedSet = await getSavedPaperIds(supabase, userId)

  const papers: FeedPaper[] = sliced.map(p => ({
    id: p.id,
    title: p.title,
    tldr: p.tldr,
    categories: p.categories ?? [],
    difficulty: p.difficulty as Difficulty | null,
    gravity_score: p.gravity_score,
    gravity_breakdown: (p.gravity_breakdown ?? {}) as GravityBreakdown,
    published_at: p.published_at,
    authors: (p.authors ?? []) as AuthorEntry[],
    arxiv_id: p.arxiv_id,
    code_url: p.code_url,
    personalization_score: p.personalization_score,
    is_saved: savedSet.has(p.id),
  }))

  return { papers, total: papers.length, hasMore }
}

/** Shape of rows returned by the get_personalized_feed RPC */
interface RpcPaperRow {
  id: string
  title: string
  tldr: string | null
  categories: string[] | null
  difficulty: string | null
  gravity_score: number
  gravity_breakdown: Record<string, number> | null
  published_at: string
  authors: unknown
  arxiv_id: string
  code_url: string | null
  personalization_score: number
}

// === CATEGORY-BOOSTED FEED (fallback for users without profile embedding) ===

interface CategoryFeedParams {
  supabase: ReturnType<typeof createServiceClient>
  userId: string
  userCategories: string[]
  limit: number
  offset: number
  categories: string[] | undefined
  difficulty: string | undefined
  minGravityScore: number
  timeCutoff: string | null
}

async function getCategoryBoostedFeed(params: CategoryFeedParams): Promise<FeedResult> {
  const {
    supabase,
    userId,
    userCategories,
    limit,
    offset,
    categories,
    difficulty,
    minGravityScore,
    timeCutoff,
  } = params

  // Build query with filters
  let query = supabase
    .from('papers')
    .select('id, title, tldr, categories, difficulty, gravity_score, gravity_breakdown, published_at, authors, arxiv_id, code_url', { count: 'exact' })
    .gte('gravity_score', minGravityScore)
    .not('enriched_at', 'is', null)
    .order('gravity_score', { ascending: false })
    .range(offset, offset + limit) // Fetch one extra for hasMore

  // Apply optional filters
  if (categories && categories.length > 0) {
    query = query.overlaps('categories', categories)
  }

  if (difficulty) {
    query = query.eq('difficulty', difficulty)
  }

  if (timeCutoff) {
    query = query.gte('published_at', timeCutoff)
  }

  const { data: papers, count, error } = await query

  if (error || !papers) {
    return { papers: [], total: 0, hasMore: false }
  }

  const hasMore = papers.length > limit
  const sliced = papers.slice(0, limit)

  // Get saved paper IDs
  const savedSet = await getSavedPaperIds(supabase, userId)

  // Compute a simple personalization_score based on category overlap
  const userCatSet = new Set(userCategories)

  const feedPapers: FeedPaper[] = sliced.map(p => {
    const paperCats = (p.categories ?? []) as string[]
    const overlapCount = paperCats.filter(c => userCatSet.has(c)).length
    // Boost: each matching category adds 10 points to gravity_score for ranking
    const categoryBoost = userCatSet.size > 0 ? overlapCount * 10 : 0
    const score = (p.gravity_score ?? 0) + categoryBoost

    return {
      id: p.id,
      title: p.title,
      tldr: p.tldr,
      categories: paperCats,
      difficulty: p.difficulty as Difficulty | null,
      gravity_score: p.gravity_score ?? 0,
      gravity_breakdown: (p.gravity_breakdown ?? {}) as GravityBreakdown,
      published_at: p.published_at,
      authors: (p.authors ?? []) as AuthorEntry[],
      arxiv_id: p.arxiv_id,
      code_url: p.code_url,
      personalization_score: score,
      is_saved: savedSet.has(p.id),
    }
  })

  // Re-sort by personalization_score (category boost may have changed order)
  feedPapers.sort((a, b) => b.personalization_score - a.personalization_score)

  return {
    papers: feedPapers,
    total: count ?? feedPapers.length,
    hasMore,
  }
}

// === TRENDING FEED (unauthenticated users) ===

/**
 * Generate a trending feed for unauthenticated users.
 * Pure gravity_score ranking with optional filters. No personalization.
 */
export async function getTrendingFeed(options: TrendingFeedOptions): Promise<FeedResult> {
  const {
    limit = 20,
    offset = 0,
    categories,
    difficulty,
    timeRange,
  } = options

  const supabase = createServiceClient()
  const timeCutoff = getTimeCutoff(timeRange)

  let query = supabase
    .from('papers')
    .select('id, title, tldr, categories, difficulty, gravity_score, gravity_breakdown, published_at, authors, arxiv_id, code_url', { count: 'exact' })
    .not('enriched_at', 'is', null)
    .order('gravity_score', { ascending: false })
    .range(offset, offset + limit) // Fetch one extra for hasMore

  if (categories && categories.length > 0) {
    query = query.overlaps('categories', categories)
  }

  if (difficulty) {
    query = query.eq('difficulty', difficulty)
  }

  if (timeCutoff) {
    query = query.gte('published_at', timeCutoff)
  }

  const { data: papers, count, error } = await query

  if (error || !papers) {
    return { papers: [], total: 0, hasMore: false }
  }

  const hasMore = papers.length > limit
  const sliced = papers.slice(0, limit)

  const feedPapers: FeedPaper[] = sliced.map(p => ({
    id: p.id,
    title: p.title,
    tldr: p.tldr,
    categories: (p.categories ?? []) as string[],
    difficulty: p.difficulty as Difficulty | null,
    gravity_score: p.gravity_score ?? 0,
    gravity_breakdown: (p.gravity_breakdown ?? {}) as GravityBreakdown,
    published_at: p.published_at,
    authors: (p.authors ?? []) as AuthorEntry[],
    arxiv_id: p.arxiv_id,
    code_url: p.code_url,
    personalization_score: p.gravity_score ?? 0, // No personalization -- use raw gravity
    is_saved: false, // Unauthenticated users can't save
  }))

  return {
    papers: feedPapers,
    total: count ?? feedPapers.length,
    hasMore,
  }
}
