// page.tsx — Browse all clusters: grid of cluster cards sorted by top gravity score
// Deps: @/lib/db/server, @/types/database, next/link
// Used by: /clusters route, navbar link

import Link from 'next/link'
import type { Metadata } from 'next'
import { createServiceClient } from '@/lib/db/server'
import type { Cluster } from '@/types/database'
import GravityBadge from '@/components/gravity-badge'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Research Clusters | PaperRadar',
  description: 'Browse AI research paper clusters organized by topic similarity.',
}

// === TYPES ===

interface ClustersPageProps {
  searchParams: Promise<{ q?: string }>
}

// === DATA FETCHING ===

async function getClusters(query?: string): Promise<Cluster[]> {
  const supabase = createServiceClient()

  let builder = supabase
    .from('clusters')
    .select('*')
    .order('top_gravity_score', { ascending: false })

  // Simple text match filter on label
  if (query && query.trim().length > 0) {
    builder = builder.ilike('label', `%${query.trim()}%`)
  }

  const { data, error } = await builder

  if (error) {
    console.error('Failed to fetch clusters:', error.message)
    return []
  }

  return (data as Cluster[]) ?? []
}

// === MAIN COMPONENT ===

export default async function ClustersPage({ searchParams }: ClustersPageProps) {
  const { q } = await searchParams
  const clusters = await getClusters(q)

  return (
    <div className="mx-auto max-w-5xl">
      {/* Page header */}
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-gray-100 sm:text-3xl">
          Research Clusters
        </h1>
        <p className="mt-2 text-gray-400">
          Papers grouped by topic similarity. Explore clusters to discover related research.
        </p>
      </header>

      {/* Search bar */}
      <form action="/clusters" method="GET" className="mb-6">
        <div className="relative">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
          >
            <path
              fillRule="evenodd"
              d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z"
              clipRule="evenodd"
            />
          </svg>
          <input
            type="text"
            name="q"
            defaultValue={q ?? ''}
            placeholder="Search clusters by topic..."
            className="w-full rounded-lg border border-gray-800 bg-gray-900 py-2.5 pl-10 pr-4 text-sm text-gray-200 placeholder-gray-500 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </form>

      {/* Active filter indicator */}
      {q && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-sm text-gray-500">
            Showing results for &quot;{q}&quot;
          </span>
          <Link
            href="/clusters"
            className="text-sm text-indigo-400 transition-colors hover:text-indigo-300"
          >
            Clear
          </Link>
        </div>
      )}

      {/* Cluster grid */}
      {clusters.length === 0 ? (
        <div className="rounded-lg border border-gray-800 bg-gray-900 px-6 py-12 text-center">
          <p className="text-gray-500">
            {q ? `No clusters found matching "${q}".` : 'No clusters available yet.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clusters.map((cluster) => (
            <ClusterCard key={cluster.id} cluster={cluster} />
          ))}
        </div>
      )}
    </div>
  )
}

// === CLUSTER CARD ===

function ClusterCard({ cluster }: { cluster: Cluster }) {
  return (
    <Link
      href={`/cluster/${cluster.id}`}
      className="group flex flex-col rounded-lg border border-gray-800 bg-gray-900 p-5 transition-colors hover:border-gray-700 hover:bg-gray-800/50"
    >
      {/* Top row: label + gravity badge */}
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base font-semibold leading-snug text-gray-200 transition-colors group-hover:text-indigo-400">
          {cluster.label}
        </h2>
        <GravityBadge score={cluster.top_gravity_score} size="sm" />
      </div>

      {/* Description */}
      {cluster.description && (
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-gray-500">
          {cluster.description}
        </p>
      )}

      {/* Stats row */}
      <div className="mt-auto flex items-center gap-3 pt-4 text-xs text-gray-500">
        <span className="inline-flex items-center gap-1">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-3.5 w-3.5"
          >
            <path d="M3 3.5A1.5 1.5 0 0 1 4.5 2h6.879a1.5 1.5 0 0 1 1.06.44l4.122 4.12A1.5 1.5 0 0 1 17 7.622V16.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 16.5v-13Z" />
          </svg>
          {cluster.paper_count} paper{cluster.paper_count !== 1 ? 's' : ''}
        </span>

        <span className="text-gray-700" aria-hidden="true">
          &middot;
        </span>

        <span>
          Similarity: {cluster.avg_similarity.toFixed(3)}
        </span>
      </div>
    </Link>
  )
}
