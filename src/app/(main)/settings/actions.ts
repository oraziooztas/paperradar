'use server'

// actions.ts — Server actions for user settings (profile, categories, digest)
// Deps: @/lib/db/server, next/cache | Used by: settings-form.tsx
// Why: server actions keep mutation logic on the server, avoiding API routes for simple updates

import { createServerComponentClient } from '@/lib/db/server'
import { revalidatePath } from 'next/cache'
import type { DigestFrequency } from '@/types/database'

// === UPDATE CATEGORIES ===

export async function updateCategories(categories: string[]): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerComponentClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { error } = await supabase
      .from('profiles')
      .update({ categories })
      .eq('id', user.id)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/settings')
    return { success: true }
  } catch {
    return { success: false, error: 'Failed to update categories' }
  }
}

// === UPDATE DIGEST FREQUENCY ===

export async function updateDigestFrequency(
  frequency: DigestFrequency
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerComponentClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { error } = await supabase
      .from('profiles')
      .update({ digest_frequency: frequency })
      .eq('id', user.id)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/settings')
    return { success: true }
  } catch {
    return { success: false, error: 'Failed to update digest frequency' }
  }
}

// === UPDATE DISPLAY NAME ===

export async function updateDisplayName(
  name: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerComponentClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const trimmed = name.trim()
    if (trimmed.length === 0) {
      return { success: false, error: 'Display name cannot be empty' }
    }
    if (trimmed.length > 100) {
      return { success: false, error: 'Display name is too long (max 100 characters)' }
    }

    const { error } = await supabase
      .from('profiles')
      .update({ display_name: trimmed })
      .eq('id', user.id)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/settings')
    return { success: true }
  } catch {
    return { success: false, error: 'Failed to update display name' }
  }
}

// === UNSAVE PAPER ===

export async function unsavePaper(
  paperId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerComponentClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { error } = await supabase
      .from('saved_papers')
      .delete()
      .eq('user_id', user.id)
      .eq('paper_id', paperId)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/settings')
    return { success: true }
  } catch {
    return { success: false, error: 'Failed to unsave paper' }
  }
}
