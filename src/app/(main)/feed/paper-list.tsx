// paper-list.tsx -- Server component that renders a list of paper cards
// Deps: @/components/gravity-badge, category-badge, save-button, next/link
// Used by: feed/page.tsx

import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import GravityBadge from '@/components/gravity-badge'
import { CategoryBadge, DifficultyBadge } from '@/components/category-badge'
import SaveButton from '@/components/save-button'
import type { AuthorEntry, Difficulty, GravityBreakdown } from '@/types/database'

// === TYPES ===

export interface FeedPaper {
  id: string
  title: string
  tldr: string | null
  categories: string[]
  difficulty: Difficulty | null
  gravity_score: number
  gravity_breakdown: GravityBreakdown
  published_at: string
  authors: AuthorEntry[]
  arxiv_id: string
  code_url: string | null
}

interface PaperListProps {
  papers: FeedPaper[]
  savedPaperIds: Set<string>
  isAuthenticated: boolean
}

// === MAIN COMPONENT ===

export default function PaperList({
  papers,
  savedPaperIds,
  isAuthenticated,
}: PaperListProps) {
  if (papers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-gray-800 bg-gray-900 px-6 py-16 text-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="mb-4 h-12 w-12 text-gray-600"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Zm3.75 11.625a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
          />
        </svg>
        <h3 className="text-lg font-semibold text-gray-300">
          No papers found
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Try adjusting your filters or check back later for new papers.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {papers.map((paper) => (
        <PaperCard
          key={paper.id}
          paper={paper}
          isSaved={savedPaperIds.has(paper.id)}
          isAuthenticated={isAuthenticated}
        />
      ))}
    </div>
  )
}

// === PAPER CARD ===

function PaperCard({
  paper,
  isSaved,
  isAuthenticated,
}: {
  paper: FeedPaper
  isSaved: boolean
  isAuthenticated: boolean
}) {
  const relativeTime = formatDistanceToNow(new Date(paper.published_at), {
    addSuffix: true,
  })

  // Show first 3 authors + overflow count
  const visibleAuthors = paper.authors.slice(0, 3)
  const overflowCount = paper.authors.length - 3

  return (
    <article className="group rounded-lg border border-gray-800 bg-gray-900 p-4 transition-colors hover:border-gray-700 sm:p-5">
      <div className="flex gap-4">
        {/* Gravity score badge */}
        <div className="hidden shrink-0 sm:block">
          <GravityBadge
            score={paper.gravity_score}
            size="md"
            breakdown={paper.gravity_breakdown}
          />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Title row with mobile gravity score */}
          <div className="mb-1 flex items-start gap-3">
            <div className="sm:hidden">
              <GravityBadge score={paper.gravity_score} size="sm" />
            </div>
            <Link
              href={`/paper/${paper.id}`}
              className="text-base font-semibold leading-snug text-gray-100 transition-colors hover:text-indigo-400 sm:text-lg"
            >
              {paper.title}
            </Link>
          </div>

          {/* TLDR */}
          {paper.tldr && (
            <p className="mb-2 line-clamp-2 text-sm leading-relaxed text-gray-400">
              {paper.tldr}
            </p>
          )}

          {/* Badges: categories + difficulty */}
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            {paper.categories.map((cat) => (
              <CategoryBadge key={cat} category={cat} />
            ))}
            {paper.difficulty && (
              <DifficultyBadge difficulty={paper.difficulty} />
            )}
          </div>

          {/* Meta row: authors, time, actions */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
            {/* Authors */}
            {visibleAuthors.length > 0 && (
              <span>
                {visibleAuthors.map((a) => a.name).join(', ')}
                {overflowCount > 0 && ` and ${overflowCount} more`}
              </span>
            )}

            <span className="hidden sm:inline" aria-hidden="true">
              &middot;
            </span>

            {/* Time */}
            <span>{relativeTime}</span>

            {/* Spacer to push actions right */}
            <div className="flex-1" />

            {/* Actions */}
            <div className="flex items-center gap-1">
              {/* Save button — shown for all, redirects to login if not auth */}
              <SaveButton
                paperId={paper.id}
                initialSaved={isAuthenticated ? isSaved : false}
              />

              {/* ArXiv link */}
              <a
                href={`https://arxiv.org/abs/${paper.arxiv_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm text-gray-500 transition-colors hover:text-gray-300"
                aria-label="View on ArXiv"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="h-4 w-4"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                  />
                </svg>
                <span className="hidden sm:inline">ArXiv</span>
              </a>

              {/* Code link (GitHub icon) */}
              {paper.code_url && (
                <a
                  href={paper.code_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm text-gray-500 transition-colors hover:text-gray-300"
                  aria-label="View code on GitHub"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="h-4 w-4"
                  >
                    <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                  </svg>
                  <span className="hidden sm:inline">Code</span>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}
