'use client'

// feed-filters.tsx -- Filter bar for the paper feed (category, time range, difficulty)
// Deps: next/navigation | Used by: feed/page.tsx
// Why: URL-based filtering keeps state shareable and SSR-friendly

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'

// === FILTER OPTIONS ===

const categories = [
  { value: 'all', label: 'All' },
  { value: 'NLP', label: 'NLP' },
  { value: 'Computer Vision', label: 'CV' },
  { value: 'Robotics', label: 'Robotics' },
  { value: 'Reinforcement Learning', label: 'RL' },
  { value: 'Theory', label: 'Theory' },
  { value: 'Infrastructure', label: 'Infra' },
  { value: 'Safety', label: 'Safety' },
  { value: 'Multimodal', label: 'Multimodal' },
  { value: 'Generative', label: 'Generative' },
  { value: 'Other', label: 'Other' },
] as const

const timeRanges = [
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: 'all', label: 'All' },
] as const

const difficulties = [
  { value: 'all', label: 'All' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'expert', label: 'Expert' },
] as const

// === MAIN COMPONENT ===

export default function FeedFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const activeCategory = searchParams.get('category') ?? 'all'
  const activeTimeRange = searchParams.get('timeRange') ?? 'all'
  const activeDifficulty = searchParams.get('difficulty') ?? 'all'

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())

      if (value === 'all') {
        params.delete(key)
      } else {
        params.set(key, value)
      }

      // Reset to page 1 when filters change
      params.delete('page')

      const qs = params.toString()
      router.push(qs ? `/feed?${qs}` : '/feed')
    },
    [router, searchParams]
  )

  return (
    <div className="space-y-4 rounded-lg border border-gray-800 bg-gray-900 p-4">
      {/* Category filter */}
      <FilterRow label="Category">
        {categories.map((cat) => (
          <PillButton
            key={cat.value}
            label={cat.label}
            active={activeCategory === cat.value}
            onClick={() => updateFilter('category', cat.value)}
          />
        ))}
      </FilterRow>

      {/* Time range + Difficulty on same row (desktop), stacked (mobile) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:gap-8">
        <FilterRow label="Time">
          {timeRanges.map((tr) => (
            <PillButton
              key={tr.value}
              label={tr.label}
              active={activeTimeRange === tr.value}
              onClick={() => updateFilter('timeRange', tr.value)}
            />
          ))}
        </FilterRow>

        <FilterRow label="Difficulty">
          {difficulties.map((d) => (
            <PillButton
              key={d.value}
              label={d.label}
              active={activeDifficulty === d.value}
              onClick={() => updateFilter('difficulty', d.value)}
            />
          ))}
        </FilterRow>
      </div>
    </div>
  )
}

// === SUB-COMPONENTS ===

function FilterRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-xs font-medium uppercase tracking-wider text-gray-500">
        {label}:
      </span>
      {children}
    </div>
  )
}

function PillButton({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`
        rounded-full px-3 py-1 text-sm font-medium transition-colors
        ${
          active
            ? 'bg-indigo-600 text-white'
            : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
        }
      `}
    >
      {label}
    </button>
  )
}
