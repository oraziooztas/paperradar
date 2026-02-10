// page.tsx — Billing & subscription management page (protected)
// Deps: @/lib/db/server, @/types/database, @/lib/paywall/check, ./billing-actions
// Used by: /billing route — plan info, pricing comparison, upgrade/manage CTA

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createServerComponentClient } from '@/lib/db/server'
import type { Profile, UserTier } from '@/types/database'
import { TIER_LIMITS } from '@/lib/paywall/check'
import { UpgradeButton, ManageButton } from './billing-actions'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Billing | PaperRadar',
  description: 'Manage your PaperRadar subscription and billing.',
}

// === TYPES ===

interface PlanInfo {
  name: string
  price: string
  description: string
  badge: { label: string; color: string }
}

// === CONSTANTS ===

const PLAN_INFO: Record<UserTier, PlanInfo> = {
  free: {
    name: 'Free',
    price: '$0',
    description: 'Basic access to AI research papers.',
    badge: { label: 'Free', color: 'bg-gray-700 text-gray-300' },
  },
  pro: {
    name: 'Pro',
    price: '$8/mo',
    description: 'Unlimited papers, daily digests, and advanced features.',
    badge: {
      label: 'Pro',
      color: 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30',
    },
  },
  team: {
    name: 'Team',
    price: '$20/user/mo',
    description: 'Everything in Pro, plus collaboration features for teams.',
    badge: {
      label: 'Team',
      color: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
    },
  },
}

/** Feature rows for the pricing comparison table */
const COMPARISON_FEATURES = [
  {
    label: 'Feed papers/day',
    free: '5',
    pro: 'Unlimited',
    team: 'Unlimited',
  },
  {
    label: 'Email digest',
    free: 'Weekly only',
    pro: 'Daily + Weekly',
    team: 'Daily + Weekly',
  },
  {
    label: 'Social buzz data',
    free: false,
    pro: true,
    team: true,
  },
  {
    label: 'Full Gravity Scores',
    free: 'Top 3 only',
    pro: 'All papers',
    team: 'All papers',
  },
  {
    label: 'Advanced filters',
    free: false,
    pro: true,
    team: true,
  },
  {
    label: 'Saved papers',
    free: '10 max',
    pro: 'Unlimited',
    team: 'Unlimited',
  },
  {
    label: 'Export (CSV, BibTeX)',
    free: false,
    pro: true,
    team: true,
  },
] as const

// === DATA FETCHING ===

async function getBillingProfile(): Promise<{
  profile: Profile
} | null> {
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

  if (!profile) return null

  return { profile: profile as Profile }
}

// === MAIN COMPONENT ===

export default async function BillingPage() {
  const result = await getBillingProfile()

  if (!result) {
    redirect('/login?redirectTo=/billing')
  }

  const { profile } = result
  const plan = PLAN_INFO[profile.tier]
  const limits = TIER_LIMITS[profile.tier]

  return (
    <div className="mx-auto max-w-4xl">
      {/* Page header */}
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-gray-100 sm:text-3xl">
          Billing
        </h1>
        <p className="mt-2 text-gray-400">
          Manage your subscription and view plan details.
        </p>
      </header>

      {/* Current plan card */}
      <section className="mb-8 rounded-xl border border-gray-800 bg-gray-900 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-gray-100">
                {plan.name} Plan
              </h2>
              <span
                className={`inline-flex items-center rounded-full px-3 py-0.5 text-xs font-semibold ${plan.badge.color}`}
              >
                {plan.badge.label}
              </span>
              {profile.tier !== 'free' && (
                <span className="inline-flex items-center rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-medium text-green-400 border border-green-500/30">
                  Active
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-gray-400">{plan.description}</p>
            <p className="mt-0.5 text-sm text-gray-500">
              {plan.price}
              {profile.tier !== 'free' && ' billed monthly'}
            </p>
          </div>

          <div className="shrink-0">
            {profile.tier === 'free' ? (
              <UpgradeButton />
            ) : (
              <ManageButton />
            )}
          </div>
        </div>

        {/* Free tier limitations summary */}
        {profile.tier === 'free' && (
          <div className="mt-5 border-t border-gray-800 pt-5">
            <h3 className="mb-2 text-sm font-medium text-gray-300">
              Your current limits
            </h3>
            <ul className="space-y-1.5 text-sm text-gray-500">
              <li className="flex items-center gap-2">
                <LimitIcon />
                {limits.feedPapersPerDay} papers per day in feed
              </li>
              <li className="flex items-center gap-2">
                <LimitIcon />
                {limits.savedPapersMax} saved papers maximum
              </li>
              <li className="flex items-center gap-2">
                <LimitIcon />
                Weekly digest only (no daily)
              </li>
              <li className="flex items-center gap-2">
                <LimitIcon />
                No social buzz data or advanced filters
              </li>
              <li className="flex items-center gap-2">
                <LimitIcon />
                No CSV/BibTeX export
              </li>
            </ul>
          </div>
        )}
      </section>

      {/* Pricing comparison table */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-gray-100">
          Compare Plans
        </h2>
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full min-w-[600px]">
            {/* Header */}
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900">
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-400">
                  Feature
                </th>
                <th className="px-6 py-4 text-center text-sm font-medium text-gray-400">
                  Free
                  <div className="mt-0.5 text-xs text-gray-600">$0</div>
                </th>
                <th className="px-6 py-4 text-center text-sm font-medium text-indigo-400">
                  Pro
                  <div className="mt-0.5 text-xs text-indigo-400/60">
                    $8/mo
                  </div>
                </th>
                <th className="px-6 py-4 text-center text-sm font-medium text-purple-400">
                  Team
                  <div className="mt-0.5 text-xs text-purple-400/60">
                    $20/user/mo
                  </div>
                </th>
              </tr>
            </thead>

            {/* Body */}
            <tbody className="divide-y divide-gray-800">
              {COMPARISON_FEATURES.map((feature) => (
                <tr
                  key={feature.label}
                  className="transition-colors hover:bg-gray-900/50"
                >
                  <td className="px-6 py-3 text-sm text-gray-300">
                    {feature.label}
                  </td>
                  <td className="px-6 py-3 text-center">
                    <FeatureCell value={feature.free} />
                  </td>
                  <td className="px-6 py-3 text-center">
                    <FeatureCell value={feature.pro} />
                  </td>
                  <td className="px-6 py-3 text-center">
                    <FeatureCell value={feature.team} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Bottom CTA for free users */}
        {profile.tier === 'free' && (
          <div className="mt-6 flex justify-center">
            <UpgradeButton />
          </div>
        )}
      </section>
    </div>
  )
}

// === HELPER COMPONENTS ===

function FeatureCell({ value }: { value: boolean | string }) {
  if (typeof value === 'boolean') {
    return value ? (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="mx-auto h-5 w-5 text-green-500"
      >
        <path
          fillRule="evenodd"
          d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
          clipRule="evenodd"
        />
      </svg>
    ) : (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="mx-auto h-5 w-5 text-gray-700"
      >
        <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
      </svg>
    )
  }

  return <span className="text-sm text-gray-400">{value}</span>
}

function LimitIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-4 w-4 shrink-0 text-gray-600"
    >
      <path
        fillRule="evenodd"
        d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
        clipRule="evenodd"
      />
    </svg>
  )
}
