// pagination.tsx -- Pagination controls for the paper feed
// Deps: next/link | Used by: feed/page.tsx

import Link from 'next/link'

// === TYPES ===

interface PaginationProps {
  currentPage: number
  totalPages: number
  /** Current search params to preserve filters when navigating */
  searchParams: Record<string, string>
}

// === HELPERS ===

function buildPageUrl(
  page: number,
  searchParams: Record<string, string>
): string {
  const params = new URLSearchParams(searchParams)
  if (page <= 1) {
    params.delete('page')
  } else {
    params.set('page', String(page))
  }
  const qs = params.toString()
  return qs ? `/feed?${qs}` : '/feed'
}

// === MAIN COMPONENT ===

export default function Pagination({
  currentPage,
  totalPages,
  searchParams,
}: PaginationProps) {
  // Don't render pagination if there's only 1 page or less
  if (totalPages <= 1) return null

  const hasPrevious = currentPage > 1
  const hasNext = currentPage < totalPages

  return (
    <nav
      className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900 px-4 py-3"
      aria-label="Pagination"
    >
      {/* Previous */}
      {hasPrevious ? (
        <Link
          href={buildPageUrl(currentPage - 1, searchParams)}
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="h-4 w-4"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 19.5 8.25 12l7.5-7.5"
            />
          </svg>
          Previous
        </Link>
      ) : (
        <span className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-gray-600">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="h-4 w-4"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 19.5 8.25 12l7.5-7.5"
            />
          </svg>
          Previous
        </span>
      )}

      {/* Page indicator */}
      <span className="text-sm text-gray-400">
        Page{' '}
        <span className="font-semibold text-gray-200">{currentPage}</span>
        {' '}of{' '}
        <span className="font-semibold text-gray-200">{totalPages}</span>
      </span>

      {/* Next */}
      {hasNext ? (
        <Link
          href={buildPageUrl(currentPage + 1, searchParams)}
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
        >
          Next
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="h-4 w-4"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m8.25 4.5 7.5 7.5-7.5 7.5"
            />
          </svg>
        </Link>
      ) : (
        <span className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-gray-600">
          Next
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="h-4 w-4"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m8.25 4.5 7.5 7.5-7.5 7.5"
            />
          </svg>
        </span>
      )}
    </nav>
  )
}
