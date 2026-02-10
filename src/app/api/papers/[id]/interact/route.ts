// route.ts -- Track view/click interactions for personalization
// Deps: @/lib/db/server, next/server | Used by: paper detail page, feed card clicks
// Why: captures clickstream data to build user taste profiles via weighted embeddings

import { createServerComponentClient } from '@/lib/db/server'
import { NextResponse } from 'next/server'
import type { InteractionType } from '@/types/database'

// === CONSTANTS ===

/** Minimum interval (ms) between duplicate view interactions for the same paper */
const VIEW_DEDUP_WINDOW_MS = 5 * 60 * 1000 // 5 minutes

/** Interaction types allowed through this endpoint (save/unsave handled by /save route) */
const ALLOWED_TYPES: ReadonlySet<string> = new Set(['view', 'click'])

// === POST /api/papers/[id]/interact ===

interface InteractBody {
  type: 'view' | 'click'
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: paperId } = await params
  const supabase = await createServerComponentClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse and validate request body
  let body: InteractBody
  try {
    body = (await request.json()) as InteractBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.type || !ALLOWED_TYPES.has(body.type)) {
    return NextResponse.json(
      { error: `Invalid interaction type. Allowed: ${[...ALLOWED_TYPES].join(', ')}` },
      { status: 400 }
    )
  }

  const interactionType = body.type as InteractionType

  // Rate-limit: skip duplicate views within the dedup window
  if (interactionType === 'view') {
    const cutoff = new Date(Date.now() - VIEW_DEDUP_WINDOW_MS).toISOString()

    const { data: recentView } = await supabase
      .from('user_interactions')
      .select('id')
      .eq('user_id', user.id)
      .eq('paper_id', paperId)
      .eq('interaction_type', 'view')
      .gte('created_at', cutoff)
      .limit(1)
      .maybeSingle()

    if (recentView) {
      // Already viewed recently -- acknowledge without inserting a duplicate
      return NextResponse.json({ tracked: true, deduplicated: true })
    }
  }

  // Insert the interaction
  const { error } = await supabase.from('user_interactions').insert({
    user_id: user.id,
    paper_id: paperId,
    interaction_type: interactionType,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Increment papers_read counter for view interactions
  if (interactionType === 'view') {
    await supabase.rpc('increment_profile_counter', {
      p_user_id: user.id,
      p_counter_name: 'papers_read',
    })
  }

  return NextResponse.json({ tracked: true, deduplicated: false })
}
