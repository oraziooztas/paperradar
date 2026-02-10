// page.tsx — User settings page (protected — middleware redirects unauthenticated users)
// Deps: @/lib/db/server, @/types/database, ./settings-form, upgrade-banner | Used by: /settings route
// Why: server component fetches profile + saved papers, passes to client form for interactivity

import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerComponentClient } from '@/lib/db/server'
import type { Profile, Paper } from '@/types/database'
import SettingsForm from './settings-form'
import UpgradeBanner from '@/components/upgrade-banner'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Settings | PaperRadar',
  description: 'Manage your PaperRadar profile, research interests, and digest preferences.',
}

// === DATA FETCHING ===

async function getUserProfile(): Promise<{
  profile: Profile
  email: string
  savedPapers: Paper[]
} | null> {
  const supabase = await createServerComponentClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  // Fetch or create profile
  let { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Handle new user: profile doesn't exist yet
  if (!profile) {
    const { data: newProfile, error: insertError } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        display_name: user.email?.split('@')[0] ?? null,
        categories: [],
        digest_frequency: 'weekly',
        tier: 'free',
      })
      .select('*')
      .single()

    if (insertError || !newProfile) {
      return null
    }

    profile = newProfile
  }

  // Fetch saved papers
  const { data: savedPaperRows } = await supabase
    .from('saved_papers')
    .select('paper_id')
    .eq('user_id', user.id)
    .order('saved_at', { ascending: false })

  let savedPapers: Paper[] = []

  if (savedPaperRows && savedPaperRows.length > 0) {
    const paperIds = savedPaperRows.map((row) => row.paper_id)

    const { data: papers } = await supabase
      .from('papers')
      .select('*')
      .in('id', paperIds)

    if (papers) {
      // Maintain saved_at order by matching to the original savedPaperRows order
      const paperMap = new Map(papers.map((p) => [p.id, p]))
      savedPapers = paperIds
        .map((id) => paperMap.get(id))
        .filter((p): p is Paper => p != null)
    }
  }

  return {
    profile: profile as Profile,
    email: user.email ?? '',
    savedPapers,
  }
}

// === MAIN COMPONENT ===

export default async function SettingsPage() {
  const result = await getUserProfile()

  // Double check — middleware should catch this, but be defensive
  if (!result) {
    redirect('/login?redirectTo=/settings')
  }

  const { profile, email, savedPapers } = result

  return (
    <div className="mx-auto max-w-2xl">
      {/* Page header */}
      <header className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-100 sm:text-3xl">
              Settings
            </h1>
            <p className="mt-2 text-gray-400">
              Manage your profile, research interests, and notification preferences.
            </p>
          </div>
          <Link
            href="/billing"
            className="shrink-0 rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm font-medium text-gray-300 transition-colors hover:border-gray-600 hover:bg-gray-700 hover:text-gray-100"
          >
            Manage subscription
          </Link>
        </div>
      </header>

      {/* Upgrade banner for free users */}
      {profile.tier === 'free' && (
        <div className="mb-6">
          <UpgradeBanner
            feature="Pro Features"
            description="Unlock unlimited papers, daily digests, social buzz data, advanced filters, and export."
            compact
          />
        </div>
      )}

      {/* Settings form (client component) */}
      <SettingsForm
        initialDisplayName={profile.display_name ?? ''}
        email={email}
        avatarUrl={profile.avatar_url}
        initialCategories={profile.categories}
        initialDigestFrequency={profile.digest_frequency}
        tier={profile.tier}
        savedPapers={savedPapers}
      />
    </div>
  )
}
