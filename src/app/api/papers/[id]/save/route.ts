// route.ts -- Save/unsave a paper for the authenticated user
// Deps: @/lib/db/server, next/server | Used by: paper detail page, feed cards
// Why: manages bookmarks and tracks save/unsave interactions for personalization

import { createServerComponentClient } from '@/lib/db/server'
import { NextResponse } from 'next/server'

// === POST /api/papers/[id]/save -- bookmark a paper ===

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: paperId } = await params
  const supabase = await createServerComponentClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify paper exists before saving
  const { data: paper, error: paperError } = await supabase
    .from('papers')
    .select('id')
    .eq('id', paperId)
    .single()

  if (paperError || !paper) {
    return NextResponse.json({ error: 'Paper not found' }, { status: 404 })
  }

  // Insert bookmark
  const { error } = await supabase
    .from('saved_papers')
    .insert({ user_id: user.id, paper_id: paperId })

  if (error) {
    // Unique constraint violation = already saved, treat as success
    if (error.code === '23505') {
      return NextResponse.json({ saved: true })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Track the save interaction for personalization
  await supabase.from('user_interactions').insert({
    user_id: user.id,
    paper_id: paperId,
    interaction_type: 'save',
  })

  // Increment papers_saved counter on profile
  await supabase.rpc('increment_profile_counter', {
    p_user_id: user.id,
    p_counter_name: 'papers_saved',
  })

  return NextResponse.json({ saved: true })
}

// === DELETE /api/papers/[id]/save -- remove bookmark ===

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: paperId } = await params
  const supabase = await createServerComponentClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { error, count } = await supabase
    .from('saved_papers')
    .delete({ count: 'exact' })
    .eq('user_id', user.id)
    .eq('paper_id', paperId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Only track unsave + decrement if a row was actually deleted
  if (count && count > 0) {
    await supabase.from('user_interactions').insert({
      user_id: user.id,
      paper_id: paperId,
      interaction_type: 'unsave',
    })

    // Decrement papers_saved counter (won't go below 0 thanks to SQL function)
    await supabase.rpc('decrement_profile_counter', {
      p_user_id: user.id,
      p_counter_name: 'papers_saved',
    })
  }

  return NextResponse.json({ saved: false })
}
