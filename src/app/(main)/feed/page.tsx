// page.tsx -- Feed page: trending papers (public) or personalized feed (authenticated)
// Deps: @/lib/db/server, feed-filters, paper-list, pagination, @/lib/paywall/check
// Used by: /feed route — the main entry point for paper discovery

import { Suspense } from 'react'
import { createServerComponentClient, createServiceClient } from '@/lib/db/server'
import FeedFilters from './feed-filters'
import PaperList from './paper-list'
import Pagination from './pagination'
import UpgradeBanner from '@/components/upgrade-banner'
import { TIER_LIMITS } from '@/lib/paywall/check'
import type { FeedPaper } from './paper-list'
import type { UserTier } from '@/types/database'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Feed | PaperRadar',
  description: 'Discover trending AI research papers ranked by our Gravity Engine.',
}

// === CONSTANTS ===

const PAGE_SIZE = 20

// === TYPES ===

interface FeedPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

// === HELPERS ===

/** Safely extract a single string from a search param value */
function getString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

// === MAIN PAGE COMPONENT ===

export default async function FeedPage({ searchParams }: FeedPageProps) {
  const params = await searchParams

  // Parse filter params
  const category = getString(params.category)
  const difficulty = getString(params.difficulty)
  const timeRange = getString(params.timeRange)
  const page = Math.max(1, parseInt(getString(params.page) ?? '1', 10) || 1)
  const offset = (page - 1) * PAGE_SIZE

  // Check authentication
  const authClient = await createServerComponentClient()
  const { data: { user } } = await authClient.auth.getUser()

  // Determine feed type and user tier
  let isPersonalized = false
  let feedTitle = 'Trending Papers'
  let userTier: UserTier = 'free'

  if (user) {
    // Check if user has a profile embedding for personalization + fetch tier
    const { data: profile } = await authClient
      .from('profiles')
      .select('profile_embedding, tier')
      .eq('id', user.id)
      .single()

    if (profile) {
      userTier = (profile.tier as UserTier) ?? 'free'
      if (profile.profile_embedding) {
        isPersonalized = true
        feedTitle = 'Your Personalized Feed'
      }
    }
  }

  // Fetch papers
  const supabase = createServiceClient()

  let papers: FeedPaper[] = []
  let totalCount = 0

  if (isPersonalized && user) {
    // Personalized feed via RPC
    const { data, error } = await supabase.rpc('get_personalized_feed', {
      p_user_id: user.id,
      p_category: category && category !== 'all' ? category : null,
      p_difficulty: difficulty && difficulty !== 'all' ? difficulty : null,
      p_time_range: timeRange && timeRange !== 'all' ? timeRange : null,
      p_limit: PAGE_SIZE,
      p_offset: offset,
    })

    if (!error && data) {
      papers = data as FeedPaper[]
      // RPC may not return count — fallback to array length for rough estimate
      totalCount = papers.length < PAGE_SIZE ? offset + papers.length : offset + PAGE_SIZE + 1
    }
  } else {
    // Standard gravity-score feed for unauthenticated or no-embedding users
    let query = supabase
      .from('papers')
      .select(
        'id, title, tldr, categories, difficulty, gravity_score, gravity_breakdown, published_at, authors, arxiv_id, code_url',
        { count: 'exact' }
      )
      .not('enriched_at', 'is', null)
      .order('gravity_score', { ascending: false })

    // Apply category filter
    if (category && category !== 'all') {
      query = query.contains('categories', [category])
    }

    // Apply difficulty filter
    if (difficulty && difficulty !== 'all') {
      query = query.eq('difficulty', difficulty)
    }

    // Apply time range filter
    if (timeRange && timeRange !== 'all') {
      const since = new Date()
      if (timeRange === '24h') since.setHours(since.getHours() - 24)
      else if (timeRange === '7d') since.setDate(since.getDate() - 7)
      else if (timeRange === '30d') since.setDate(since.getDate() - 30)
      query = query.gte('published_at', since.toISOString())
    }

    // Pagination
    query = query.range(offset, offset + PAGE_SIZE - 1)

    const { data, count, error } = await query

    if (!error && data) {
      papers = data as FeedPaper[]
      totalCount = count ?? 0
    }
  }

  // Fetch saved paper IDs for authenticated users
  const savedPaperIds = new Set<string>()

  if (user && papers.length > 0) {
    const paperIds = papers.map((p) => p.id)
    const { data: savedRows } = await authClient
      .from('saved_papers')
      .select('paper_id')
      .eq('user_id', user.id)
      .in('paper_id', paperIds)

    if (savedRows) {
      for (const row of savedRows) {
        savedPaperIds.add(row.paper_id)
      }
    }
  }

  // === FREE TIER DAILY LIMIT ===
  // For free-tier authenticated users, limit visible papers to the daily cap
  let isFreeTierLimited = false
  let visiblePapers = papers

  if (user && userTier === 'free') {
    const dailyLimit = TIER_LIMITS.free.feedPapersPerDay

    // Count how many papers the user has already viewed today
    const todayMidnight = new Date()
    todayMidnight.setHours(0, 0, 0, 0)

    const { count: viewedTodayCount } = await authClient
      .from('user_interactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('interaction_type', 'view')
      .gte('created_at', todayMidnight.toISOString())

    const viewedToday = viewedTodayCount ?? 0
    const remaining = Math.max(0, dailyLimit - viewedToday)

    if (remaining < papers.length) {
      visiblePapers = papers.slice(0, Math.max(remaining, 0))
      isFreeTierLimited = true
    }
  }

  // Calculate total pages
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  // Build a clean search params record for pagination links
  const cleanParams: Record<string, string> = {}
  if (category && category !== 'all') cleanParams.category = category
  if (difficulty && difficulty !== 'all') cleanParams.difficulty = difficulty
  if (timeRange && timeRange !== 'all') cleanParams.timeRange = timeRange

  return (
    <div className="mx-auto max-w-4xl">
      {/* Filter bar */}
      <Suspense fallback={<FilterSkeleton />}>
        <FeedFilters />
      </Suspense>

      {/* Feed header */}
      <div className="mt-6 mb-4 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">{feedTitle}</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {totalCount === 0
              ? 'No papers found'
              : totalCount === 1
                ? 'Showing 1 paper'
                : `Showing ${offset + 1}\u2013${Math.min(offset + PAGE_SIZE, totalCount)} of ${totalCount} papers`}
          </p>
        </div>
      </div>

      {/* Paper list */}
      <PaperList
        papers={visiblePapers}
        savedPaperIds={savedPaperIds}
        isAuthenticated={!!user}
      />

      {/* Free tier limit banner — shown when papers are truncated */}
      {isFreeTierLimited && (
        <div className="mt-4">
          <UpgradeBanner
            feature="Unlimited Feed"
            description={`You\u2019ve reached your daily limit of ${TIER_LIMITS.free.feedPapersPerDay} papers. Upgrade to Pro for unlimited access to all research papers.`}
          />
        </div>
      )}

      {/* Pagination — hide when free tier limit cuts off results */}
      {!isFreeTierLimited && (
        <div className="mt-4">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            searchParams={cleanParams}
          />
        </div>
      )}
    </div>
  )
}

// === SKELETON COMPONENTS ===

function FilterSkeleton() {
  return (
    <div className="animate-pulse space-y-4 rounded-lg border border-gray-800 bg-gray-900 p-4">
      <div className="flex gap-2">
        <div className="h-7 w-12 rounded-full bg-gray-800" />
        <div className="h-7 w-16 rounded-full bg-gray-800" />
        <div className="h-7 w-10 rounded-full bg-gray-800" />
        <div className="h-7 w-14 rounded-full bg-gray-800" />
        <div className="h-7 w-10 rounded-full bg-gray-800" />
      </div>
      <div className="flex gap-2">
        <div className="h-7 w-12 rounded-full bg-gray-800" />
        <div className="h-7 w-10 rounded-full bg-gray-800" />
        <div className="h-7 w-10 rounded-full bg-gray-800" />
        <div className="h-7 w-12 rounded-full bg-gray-800" />
      </div>
    </div>
  )
}
