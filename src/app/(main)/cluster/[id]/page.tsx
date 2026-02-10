// page.tsx — Cluster detail page: shows all papers in a cluster sorted by gravity score
// Deps: @/lib/db/server, @/components/paper-card, @/types/database, next/link, next/navigation
// Used by: /cluster/[id] route

import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createServiceClient } from '@/lib/db/server'
import type { Paper, Cluster } from '@/types/database'
import PaperCard from '@/components/paper-card'
import GravityBadge from '@/components/gravity-badge'

export const dynamic = 'force-dynamic'

// === TYPES ===

interface ClusterPageProps {
  params: Promise<{ id: string }>
}

// === METADATA ===

export async function generateMetadata({ params }: ClusterPageProps): Promise<Metadata> {
  const { id } = await params
  const supabase = createServiceClient()

  const { data: cluster } = await supabase
    .from('clusters')
    .select('label, description, paper_count')
    .eq('id', id)
    .single()

  if (!cluster) {
    return { title: 'Cluster Not Found | PaperRadar' }
  }

  return {
    title: `${cluster.label} | PaperRadar`,
    description:
      cluster.description ??
      `Explore ${cluster.paper_count} papers in the "${cluster.label}" research cluster.`,
  }
}

// === DATA FETCHING ===

async function getClusterWithPapers(clusterId: string): Promise<{
  cluster: Cluster
  papers: Paper[]
} | null> {
  const supabase = createServiceClient()

  // Fetch cluster
  const { data: cluster, error: clusterError } = await supabase
    .from('clusters')
    .select('*')
    .eq('id', clusterId)
    .single()

  if (clusterError || !cluster) return null

  // Fetch papers via junction table, sorted by gravity_score DESC
  const { data: paperClusters } = await supabase
    .from('paper_clusters')
    .select('paper_id, similarity_score')
    .eq('cluster_id', clusterId)

  if (!paperClusters || paperClusters.length === 0) {
    return { cluster: cluster as Cluster, papers: [] }
  }

  const paperIds = paperClusters.map((pc) => pc.paper_id)

  const { data: papers } = await supabase
    .from('papers')
    .select('*')
    .in('id', paperIds)
    .order('gravity_score', { ascending: false })

  return {
    cluster: cluster as Cluster,
    papers: (papers as Paper[]) ?? [],
  }
}

// === MAIN COMPONENT ===

export default async function ClusterPage({ params }: ClusterPageProps) {
  const { id } = await params
  const result = await getClusterWithPapers(id)

  if (!result) {
    notFound()
  }

  const { cluster, papers } = result

  return (
    <div className="mx-auto max-w-4xl">
      {/* Back link */}
      <Link
        href="/clusters"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-400 transition-colors hover:text-gray-200"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-4 w-4"
        >
          <path
            fillRule="evenodd"
            d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z"
            clipRule="evenodd"
          />
        </svg>
        Back to Clusters
      </Link>

      {/* Cluster header */}
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-gray-100 sm:text-3xl">
          {cluster.label}
        </h1>

        {/* Stats row */}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-gray-400">
          <span className="inline-flex items-center gap-1.5">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4 text-gray-500"
            >
              <path d="M3 3.5A1.5 1.5 0 0 1 4.5 2h6.879a1.5 1.5 0 0 1 1.06.44l4.122 4.12A1.5 1.5 0 0 1 17 7.622V16.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 16.5v-13Z" />
            </svg>
            {cluster.paper_count} paper{cluster.paper_count !== 1 ? 's' : ''}
          </span>

          <span className="text-gray-700" aria-hidden="true">
            &middot;
          </span>

          <span>Avg similarity: {cluster.avg_similarity.toFixed(3)}</span>

          <span className="text-gray-700" aria-hidden="true">
            &middot;
          </span>

          <span className="inline-flex items-center gap-1.5">
            Top Gravity Score:
            <GravityBadge score={cluster.top_gravity_score} size="sm" />
          </span>
        </div>

        {/* Description */}
        {cluster.description && (
          <p className="mt-4 leading-relaxed text-gray-400">
            {cluster.description}
          </p>
        )}
      </header>

      {/* Divider */}
      <div className="mb-6 border-t border-gray-800" />

      {/* Section heading */}
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-gray-500">
        Papers in this cluster
        <span className="ml-2 text-gray-600">
          (sorted by gravity score)
        </span>
      </h2>

      {/* Papers list */}
      {papers.length === 0 ? (
        <div className="rounded-lg border border-gray-800 bg-gray-900 px-6 py-12 text-center">
          <p className="text-gray-500">No papers found in this cluster yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {papers.map((paper) => (
            <PaperCard key={paper.id} paper={paper} />
          ))}
        </div>
      )}
    </div>
  )
}
