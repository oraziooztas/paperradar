'use client'

// settings-form.tsx — Client component for settings: categories, digest, display name, saved papers
// Deps: react, @/types/database, ./actions | Used by: settings/page.tsx
// Why: client component handles interactive toggles, optimistic updates, and inline toasts

import { useState, useTransition, useOptimistic } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/db/supabase'
import type { DigestFrequency, Paper, UserTier } from '@/types/database'
import { updateCategories, updateDigestFrequency, updateDisplayName, unsavePaper } from './actions'
import Link from 'next/link'
import GravityBadge from '@/components/gravity-badge'

// === CONSTANTS ===

const AVAILABLE_CATEGORIES = [
  'NLP',
  'Computer Vision',
  'Robotics',
  'Reinforcement Learning',
  'Theory',
  'Infrastructure',
  'Safety',
  'Multimodal',
  'Generative',
  'Optimization',
  'Graph',
  'Audio',
  'Other',
] as const

const DIGEST_OPTIONS: { value: DigestFrequency; label: string; description: string }[] = [
  { value: 'daily', label: 'Daily', description: 'Get a digest every morning' },
  { value: 'weekly', label: 'Weekly', description: 'Get a digest every Monday' },
  { value: 'none', label: 'None', description: 'No email digests' },
]

const TIER_CONFIG: Record<UserTier, { label: string; color: string }> = {
  free: { label: 'Free', color: 'bg-gray-700 text-gray-300' },
  pro: { label: 'Pro', color: 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' },
  team: { label: 'Team', color: 'bg-purple-500/20 text-purple-400 border border-purple-500/30' },
}

// === TYPES ===

interface SettingsFormProps {
  initialDisplayName: string
  email: string
  avatarUrl: string | null
  initialCategories: string[]
  initialDigestFrequency: DigestFrequency
  tier: UserTier
  savedPapers: Paper[]
}

interface Toast {
  message: string
  type: 'success' | 'error'
}

// === MAIN COMPONENT ===

export default function SettingsForm({
  initialDisplayName,
  email,
  avatarUrl,
  initialCategories,
  initialDigestFrequency,
  tier,
  savedPapers,
}: SettingsFormProps) {
  const router = useRouter()

  // === Toast state ===
  const [toast, setToast] = useState<Toast | null>(null)

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  return (
    <div className="space-y-8">
      {/* Inline toast notification */}
      {toast && (
        <div
          className={`fixed right-4 top-20 z-50 rounded-lg px-4 py-3 text-sm font-medium shadow-lg transition-all ${
            toast.type === 'success'
              ? 'border border-green-500/30 bg-green-500/10 text-green-400'
              : 'border border-red-500/30 bg-red-500/10 text-red-400'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Section 1: Profile */}
      <ProfileSection
        initialDisplayName={initialDisplayName}
        email={email}
        avatarUrl={avatarUrl}
        onToast={showToast}
      />

      <div className="border-t border-gray-800" />

      {/* Section 2: Research Interests */}
      <CategoriesSection
        initialCategories={initialCategories}
        onToast={showToast}
      />

      <div className="border-t border-gray-800" />

      {/* Section 3: Digest Settings */}
      <DigestSection
        initialFrequency={initialDigestFrequency}
        onToast={showToast}
      />

      <div className="border-t border-gray-800" />

      {/* Section 4: Saved Papers */}
      <SavedPapersSection
        papers={savedPapers}
        onToast={showToast}
      />

      <div className="border-t border-gray-800" />

      {/* Section 5: Account */}
      <AccountSection tier={tier} router={router} />
    </div>
  )
}

// === PROFILE SECTION ===

function ProfileSection({
  initialDisplayName,
  email,
  avatarUrl,
  onToast,
}: {
  initialDisplayName: string
  email: string
  avatarUrl: string | null
  onToast: (message: string, type: 'success' | 'error') => void
}) {
  const [displayName, setDisplayName] = useState(initialDisplayName)
  const [isEditing, setIsEditing] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSaveName() {
    startTransition(async () => {
      const result = await updateDisplayName(displayName)
      if (result.success) {
        setIsEditing(false)
        onToast('Display name updated', 'success')
      } else {
        onToast(result.error ?? 'Failed to update', 'error')
      }
    })
  }

  function getInitials(name: string): string {
    return name
      .split(' ')
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase()
  }

  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold text-gray-100">Profile</h2>

      <div className="flex items-start gap-4">
        {/* Avatar */}
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName}
            className="h-16 w-16 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-500/20 text-xl font-semibold text-indigo-400">
            {getInitials(displayName || email.split('@')[0])}
          </div>
        )}

        <div className="flex-1 space-y-3">
          {/* Display name */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-400">
              Display Name
            </label>
            {isEditing ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  maxLength={100}
                  autoFocus
                />
                <button
                  onClick={handleSaveName}
                  disabled={isPending}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
                >
                  {isPending ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => {
                    setDisplayName(initialDisplayName)
                    setIsEditing(false)
                  }}
                  className="rounded-lg px-3 py-1.5 text-sm text-gray-400 transition-colors hover:text-gray-200"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-200">{displayName || 'Not set'}</span>
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-sm text-indigo-400 transition-colors hover:text-indigo-300"
                >
                  Edit
                </button>
              </div>
            )}
          </div>

          {/* Email (read-only) */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-400">
              Email
            </label>
            <span className="text-sm text-gray-500">{email}</span>
          </div>
        </div>
      </div>
    </section>
  )
}

// === CATEGORIES SECTION ===

function CategoriesSection({
  initialCategories,
  onToast,
}: {
  initialCategories: string[]
  onToast: (message: string, type: 'success' | 'error') => void
}) {
  const [isPending, startTransition] = useTransition()
  const [optimisticCategories, setOptimisticCategories] = useOptimistic(initialCategories)

  function handleToggleCategory(category: string) {
    const newCategories = optimisticCategories.includes(category)
      ? optimisticCategories.filter((c) => c !== category)
      : [...optimisticCategories, category]

    startTransition(async () => {
      setOptimisticCategories(newCategories)
      const result = await updateCategories(newCategories)
      if (!result.success) {
        onToast(result.error ?? 'Failed to update categories', 'error')
      }
    })
  }

  return (
    <section>
      <h2 className="mb-1 text-lg font-semibold text-gray-100">Research Interests</h2>
      <p className="mb-4 text-sm text-gray-500">
        Select categories to personalize your feed and digest.
      </p>

      <div className="flex flex-wrap gap-2">
        {AVAILABLE_CATEGORIES.map((category) => {
          const isSelected = optimisticCategories.includes(category)
          return (
            <button
              key={category}
              onClick={() => handleToggleCategory(category)}
              disabled={isPending}
              className={`
                rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all
                disabled:opacity-70
                ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-500/20 text-indigo-400'
                    : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600 hover:text-gray-300'
                }
              `}
            >
              {category}
            </button>
          )
        })}
      </div>
    </section>
  )
}

// === DIGEST SECTION ===

function DigestSection({
  initialFrequency,
  onToast,
}: {
  initialFrequency: DigestFrequency
  onToast: (message: string, type: 'success' | 'error') => void
}) {
  const [frequency, setFrequency] = useState(initialFrequency)
  const [isPending, startTransition] = useTransition()

  function handleChangeFrequency(newFrequency: DigestFrequency) {
    setFrequency(newFrequency)

    startTransition(async () => {
      const result = await updateDigestFrequency(newFrequency)
      if (result.success) {
        onToast('Digest preference updated', 'success')
      } else {
        setFrequency(initialFrequency)
        onToast(result.error ?? 'Failed to update', 'error')
      }
    })
  }

  return (
    <section>
      <h2 className="mb-1 text-lg font-semibold text-gray-100">Digest Settings</h2>
      <p className="mb-4 text-sm text-gray-500">
        Choose how often you want to receive an email digest of top papers.
      </p>

      <div className="space-y-2">
        {DIGEST_OPTIONS.map((option) => (
          <label
            key={option.value}
            className={`
              flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors
              ${
                frequency === option.value
                  ? 'border-indigo-500/50 bg-indigo-500/10'
                  : 'border-gray-800 bg-gray-900 hover:border-gray-700'
              }
            `}
          >
            {/* Custom radio */}
            <div
              className={`
                flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors
                ${
                  frequency === option.value
                    ? 'border-indigo-500'
                    : 'border-gray-600'
                }
              `}
            >
              {frequency === option.value && (
                <div className="h-2 w-2 rounded-full bg-indigo-500" />
              )}
            </div>

            <div>
              <span className="text-sm font-medium text-gray-200">{option.label}</span>
              <p className="text-xs text-gray-500">{option.description}</p>
            </div>

            <input
              type="radio"
              name="digest_frequency"
              value={option.value}
              checked={frequency === option.value}
              onChange={() => handleChangeFrequency(option.value)}
              disabled={isPending}
              className="sr-only"
            />
          </label>
        ))}
      </div>
    </section>
  )
}

// === SAVED PAPERS SECTION ===

function SavedPapersSection({
  papers,
  onToast,
}: {
  papers: Paper[]
  onToast: (message: string, type: 'success' | 'error') => void
}) {
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()

  function handleUnsave(paperId: string) {
    // Optimistic removal
    setRemovedIds((prev) => new Set(prev).add(paperId))

    startTransition(async () => {
      const result = await unsavePaper(paperId)
      if (result.success) {
        onToast('Paper removed from saved', 'success')
      } else {
        // Revert optimistic removal
        setRemovedIds((prev) => {
          const next = new Set(prev)
          next.delete(paperId)
          return next
        })
        onToast(result.error ?? 'Failed to unsave', 'error')
      }
    })
  }

  const visiblePapers = papers.filter((p) => !removedIds.has(p.id))

  return (
    <section>
      <h2 className="mb-1 text-lg font-semibold text-gray-100">Saved Papers</h2>
      <p className="mb-4 text-sm text-gray-500">
        Papers you&apos;ve bookmarked for later reading.
      </p>

      {visiblePapers.length === 0 ? (
        <div className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-8 text-center">
          <p className="text-sm text-gray-500">No saved papers yet.</p>
          <Link
            href="/feed"
            className="mt-2 inline-block text-sm text-indigo-400 transition-colors hover:text-indigo-300"
          >
            Browse the feed
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {visiblePapers.map((paper) => (
            <div
              key={paper.id}
              className="flex items-center gap-3 rounded-lg border border-gray-800 bg-gray-900 px-4 py-3 transition-colors hover:border-gray-700"
            >
              <GravityBadge score={paper.gravity_score} size="sm" />

              <Link
                href={`/paper/${paper.id}`}
                className="min-w-0 flex-1 truncate text-sm font-medium text-gray-200 transition-colors hover:text-indigo-400"
              >
                {paper.title}
              </Link>

              <button
                onClick={() => handleUnsave(paper.id)}
                disabled={isPending}
                className="shrink-0 rounded-md px-2.5 py-1 text-xs text-gray-500 transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                aria-label={`Unsave ${paper.title}`}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

// === ACCOUNT SECTION ===

function AccountSection({
  tier,
  router,
}: {
  tier: UserTier
  router: ReturnType<typeof useRouter>
}) {
  const [isPending, startTransition] = useTransition()
  const tierInfo = TIER_CONFIG[tier]

  function handleSignOut() {
    startTransition(async () => {
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/login')
      router.refresh()
    })
  }

  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold text-gray-100">Account</h2>

      <div className="space-y-4">
        {/* Current tier */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">Current plan:</span>
          <span
            className={`inline-flex items-center rounded-full px-3 py-0.5 text-xs font-semibold ${tierInfo.color}`}
          >
            {tierInfo.label}
          </span>
          {tier === 'free' && (
            <Link
              href="/billing"
              className="text-xs text-indigo-400 transition-colors hover:text-indigo-300"
            >
              Upgrade to Pro
            </Link>
          )}
        </div>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:border-gray-600 hover:bg-gray-700 hover:text-gray-100 disabled:opacity-50"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4"
          >
            <path
              fillRule="evenodd"
              d="M3 4.25A2.25 2.25 0 0 1 5.25 2h5.5A2.25 2.25 0 0 1 13 4.25v2a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 0-.75-.75h-5.5a.75.75 0 0 0-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 0 0 .75-.75v-2a.75.75 0 0 1 1.5 0v2A2.25 2.25 0 0 1 10.75 18h-5.5A2.25 2.25 0 0 1 3 15.75V4.25Z"
              clipRule="evenodd"
            />
            <path
              fillRule="evenodd"
              d="M19 10a.75.75 0 0 0-.75-.75H8.704l1.048-.943a.75.75 0 1 0-1.004-1.114l-2.5 2.25a.75.75 0 0 0 0 1.114l2.5 2.25a.75.75 0 1 0 1.004-1.114l-1.048-.943h9.546A.75.75 0 0 0 19 10Z"
              clipRule="evenodd"
            />
          </svg>
          {isPending ? 'Signing out...' : 'Sign Out'}
        </button>
      </div>
    </section>
  )
}
