// helpers.ts — Server-side auth helper functions
// Deps: lib/db/server | Used by: server components, API routes needing auth context

import { createServerComponentClient } from '@/lib/db/server'
import type { Profile } from '@/types/database'
import type { User } from '@supabase/supabase-js'

// === TYPES ===

export interface AuthenticatedUser extends User {
  profile: Profile | null
}

// === MAIN LOGIC ===

/**
 * Get the current authenticated user with their profile data.
 * Returns null if not authenticated — does NOT throw.
 */
export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const supabase = await createServerComponentClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return { ...user, profile: profile ?? null }
}

/**
 * Get the current user or throw if not authenticated.
 * Use in server components / API routes that require auth.
 */
export async function requireAuth(): Promise<AuthenticatedUser> {
  const user = await getCurrentUser()

  if (!user) {
    throw new Error('Authentication required')
  }

  return user
}
