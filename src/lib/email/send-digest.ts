// send-digest.ts — Core digest generation and sending logic
// Deps: @/lib/db/server, @/lib/feed/personalized, ./resend, ./templates/digest, crypto
// Used by: trigger/send-digests.ts (cron tasks)
// Why: fetches personalized papers per user, renders digest email, sends via Resend in batches

import { createHmac } from 'crypto'
import { createServiceClient } from '@/lib/db/server'
import { getPersonalizedFeed, getTrendingFeed } from '@/lib/feed/personalized'
import type { FeedPaper } from '@/lib/feed/personalized'
import type { DigestFrequency, UserTier } from '@/types/database'
import { getResend, FROM_EMAIL, REPLY_TO } from './resend'
import { renderDigestEmail } from './templates/digest'
import type { DigestPaper } from './templates/digest'
import { getServerEnv } from '@/lib/env'

// === TYPES ===

interface DigestResult {
  sent: boolean
  paperCount: number
}

interface BatchDigestStats {
  total: number
  sent: number
  skipped: number
  failed: number
}

// === UNSUBSCRIBE URL GENERATION ===

/**
 * Generate a signed unsubscribe URL for a given user.
 * Uses HMAC-SHA256 with the Resend API key as the signing secret.
 */
export function generateUnsubscribeUrl(userId: string): string {
  const secret = getServerEnv().RESEND_API_KEY ?? 'paperradar-secret'
  const token = createHmac('sha256', secret)
    .update(userId)
    .digest('hex')
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  return `${baseUrl}/api/email/unsubscribe?userId=${userId}&token=${token}`
}

// === HELPERS ===

/** Return the time cutoff ISO string based on digest frequency */
function getDigestCutoff(frequency: DigestFrequency): string {
  const now = new Date()
  if (frequency === 'daily') {
    now.setHours(now.getHours() - 24)
  } else {
    // weekly
    now.setDate(now.getDate() - 7)
  }
  return now.toISOString()
}

/** Determine paper limit based on user tier */
function getPaperLimit(tier: UserTier): number {
  return tier === 'free' ? 5 : 10
}

/** Map FeedPaper to DigestPaper (strip fields the template doesn't need) */
function toDigestPaper(paper: FeedPaper): DigestPaper {
  return {
    id: paper.id,
    title: paper.title,
    tldr: paper.tldr,
    gravity_score: paper.gravity_score,
    categories: paper.categories,
    published_at: paper.published_at,
    arxiv_id: paper.arxiv_id,
  }
}

/** Delay utility for rate limiting */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// === SEND DIGEST TO A SINGLE USER ===

/**
 * Generate and send a personalized digest email to one user.
 * Returns { sent: false } if no papers match or the user has no email.
 */
export async function sendDigestToUser(
  userId: string,
  frequency: DigestFrequency
): Promise<DigestResult> {
  const supabase = createServiceClient()

  // 1. Fetch user profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('display_name, categories, tier, profile_embedding')
    .eq('id', userId)
    .single()

  if (profileError || !profile) {
    console.warn(`[send-digest] Profile not found for user ${userId}`)
    return { sent: false, paperCount: 0 }
  }

  // 2. Fetch user email from auth.users (via admin API)
  const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId)

  if (authError || !authUser?.user?.email) {
    console.warn(`[send-digest] No email found for user ${userId}`)
    return { sent: false, paperCount: 0 }
  }

  const userEmail = authUser.user.email
  const tier = (profile.tier ?? 'free') as UserTier
  const paperLimit = getPaperLimit(tier)
  const cutoff = getDigestCutoff(frequency)
  const timeRange = frequency === 'daily' ? '24h' as const : '7d' as const

  // 3. Get personalized papers, with trending fallback
  let papers: FeedPaper[]
  try {
    const feedResult = await getPersonalizedFeed({
      userId,
      limit: paperLimit,
      categories: profile.categories ?? undefined,
      timeRange,
    })
    papers = feedResult.papers
  } catch {
    // Fallback to trending if personalized feed fails
    console.warn(`[send-digest] Personalized feed failed for ${userId}, falling back to trending`)
    const trendingResult = await getTrendingFeed({
      limit: paperLimit,
      timeRange,
    })
    papers = trendingResult.papers
  }

  // 4. Filter to papers published since the cutoff
  const recentPapers = papers.filter(p => p.published_at >= cutoff)

  if (recentPapers.length === 0) {
    return { sent: false, paperCount: 0 }
  }

  // 5. Render the digest email
  const digestPapers = recentPapers.map(toDigestPaper)
  const unsubscribeUrl = generateUnsubscribeUrl(userId)
  const html = await renderDigestEmail({
    userName: profile.display_name ?? 'Researcher',
    papers: digestPapers,
    frequency: frequency as 'daily' | 'weekly',
    unsubscribeUrl,
  })

  // 6. Send via Resend
  const resend = getResend()
  const frequencyLabel = frequency === 'daily' ? 'Daily' : 'Weekly'
  const { error: sendError } = await resend.emails.send({
    from: FROM_EMAIL,
    to: userEmail,
    replyTo: REPLY_TO,
    subject: `Your ${frequencyLabel} Research Digest — ${digestPapers.length} paper${digestPapers.length !== 1 ? 's' : ''}`,
    html,
    headers: {
      'List-Unsubscribe': `<${unsubscribeUrl}>`,
    },
  })

  if (sendError) {
    console.error(`[send-digest] Failed to send to ${userId}:`, sendError)
    return { sent: false, paperCount: 0 }
  }

  return { sent: true, paperCount: digestPapers.length }
}

// === BATCH SEND DIGESTS ===

/**
 * Send digest emails to all users with the given frequency preference.
 * Processes in batches of 10 with 100ms delay between batches to respect Resend rate limits.
 */
export async function sendBatchDigests(
  frequency: DigestFrequency
): Promise<BatchDigestStats> {
  const supabase = createServiceClient()

  // 1. Query all users who want this frequency
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('digest_frequency', frequency)

  if (error || !profiles) {
    console.error(`[send-digest] Failed to query profiles for ${frequency}:`, error)
    return { total: 0, sent: 0, skipped: 0, failed: 0 }
  }

  const stats: BatchDigestStats = {
    total: profiles.length,
    sent: 0,
    skipped: 0,
    failed: 0,
  }

  // 2. Process in batches of 10
  const BATCH_SIZE = 10
  for (let i = 0; i < profiles.length; i += BATCH_SIZE) {
    const batch = profiles.slice(i, i + BATCH_SIZE)

    const results = await Promise.allSettled(
      batch.map(profile => sendDigestToUser(profile.id, frequency))
    )

    for (const result of results) {
      if (result.status === 'fulfilled') {
        if (result.value.sent) {
          stats.sent++
        } else {
          stats.skipped++
        }
      } else {
        stats.failed++
        console.error('[send-digest] User digest failed:', result.reason)
      }
    }

    // Rate limit: wait between batches (skip delay after last batch)
    if (i + BATCH_SIZE < profiles.length) {
      await delay(100)
    }
  }

  console.log(
    `[send-digest] ${frequency} batch complete:`,
    `total=${stats.total}, sent=${stats.sent}, skipped=${stats.skipped}, failed=${stats.failed}`
  )

  return stats
}
