// route.ts — Pipeline status API
// Deps: @/lib/db/server | Used by: admin dashboard
// Returns overview stats for the pipeline

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/db/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createServiceClient()

  const [
    { count: totalPapers },
    { count: enrichedPapers },
    { count: embeddedPapers },
    { count: scoredPapers },
    { count: totalClusters },
    { data: recentRuns },
  ] = await Promise.all([
    supabase.from('papers').select('*', { count: 'exact', head: true }),
    supabase.from('papers').select('*', { count: 'exact', head: true }).not('enriched_at', 'is', null),
    supabase.from('papers').select('*', { count: 'exact', head: true }).not('embedded_at', 'is', null),
    supabase.from('papers').select('*', { count: 'exact', head: true }).not('scored_at', 'is', null),
    supabase.from('clusters').select('*', { count: 'exact', head: true }),
    supabase.from('pipeline_runs').select('*').order('started_at', { ascending: false }).limit(5),
  ])

  return NextResponse.json({
    papers: {
      total: totalPapers ?? 0,
      enriched: enrichedPapers ?? 0,
      embedded: embeddedPapers ?? 0,
      scored: scoredPapers ?? 0,
    },
    clusters: totalClusters ?? 0,
    recentRuns: recentRuns ?? [],
  })
}
