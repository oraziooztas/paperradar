// paper-card.tsx — Reusable paper card for feeds and lists (server component)
// Deps: @/types/database, gravity-badge, category-badge, save-button, next/link
// Used by: feed page, trending page, search results, saved papers

import Link from 'next/link'
import type { Paper } from '@/types/database'
import GravityBadge from '@/components/gravity-badge'
import { CategoryBadge, DifficultyBadge } from '@/components/category-badge'
import SaveButton from '@/components/save-button'

// === TYPES ===

interface PaperCardProps {
  paper: Paper
  showSaveButton?: boolean
  initialSaved?: boolean
  compact?: boolean
}

// === HELPERS ===

function formatRelativeTime(dateString: string): string {
  const now = new Date()
  const date = new Date(dateString)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  const diffHours = Math.floor(diffMs / 3_600_000)
  const diffDays = Math.floor(diffMs / 86_400_000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 30) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatAuthors(authors: Paper['authors'], max = 3): string {
  if (!authors || authors.length === 0) return 'Unknown authors'
  const names = authors.slice(0, max).map((a) => a.name)
  const remaining = authors.length - max
  return remaining > 0 ? `${names.join(', ')} +${remaining} more` : names.join(', ')
}

// === MAIN COMPONENT ===

export default function PaperCard({
  paper,
  showSaveButton = false,
  initialSaved = false,
  compact = false,
}: PaperCardProps) {
  const {
    id,
    title,
    tldr,
    authors,
    categories,
    difficulty,
    gravity_score,
    gravity_breakdown,
    published_at,
  } = paper

  return (
    <article
      className={`
        group flex gap-4 rounded-lg border border-gray-800 bg-gray-900
        transition-colors hover:border-gray-700 hover:bg-gray-800/50
        ${compact ? 'px-3 py-3' : 'px-4 py-4 sm:px-5 sm:py-5'}
      `}
    >
      {/* Gravity score */}
      <div className="flex shrink-0 items-start pt-0.5">
        <GravityBadge
          score={gravity_score}
          size={compact ? 'sm' : 'md'}
          breakdown={gravity_breakdown}
        />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {/* Title */}
        <Link
          href={`/paper/${id}`}
          className="block text-gray-100 transition-colors hover:text-indigo-400"
        >
          <h3
            className={`font-semibold leading-snug ${
              compact ? 'text-sm' : 'text-base sm:text-lg'
            }`}
          >
            {title}
          </h3>
        </Link>

        {/* TLDR */}
        {tldr && !compact && (
          <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-gray-400">
            {tldr}
          </p>
        )}

        {/* Meta row: badges + time + authors */}
        <div
          className={`flex flex-wrap items-center gap-2 ${
            compact ? 'mt-1.5' : 'mt-3'
          }`}
        >
          {/* Category badges */}
          {categories.slice(0, 3).map((cat) => (
            <CategoryBadge key={cat} category={cat} />
          ))}

          {/* Difficulty badge */}
          {difficulty && <DifficultyBadge difficulty={difficulty} />}

          {/* Separator */}
          <span className="text-gray-700" aria-hidden="true">
            &middot;
          </span>

          {/* Time */}
          <span className="text-xs text-gray-500">
            {formatRelativeTime(published_at)}
          </span>

          {/* Separator */}
          <span className="text-gray-700" aria-hidden="true">
            &middot;
          </span>

          {/* Authors */}
          <span className="text-xs text-gray-500">
            by {formatAuthors(authors)}
          </span>
        </div>

        {/* Action buttons */}
        {!compact && (
          <div className="mt-3 flex items-center gap-2">
            {showSaveButton && (
              <SaveButton paperId={id} initialSaved={initialSaved} />
            )}

            {/* Share button (static — no interactivity needed for now) */}
            <button
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-gray-500 transition-colors hover:text-gray-300"
              aria-label="Share paper"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                className="h-5 w-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z"
                />
              </svg>
              <span className="hidden sm:inline">Share</span>
            </button>
          </div>
        )}
      </div>
    </article>
  )
}
