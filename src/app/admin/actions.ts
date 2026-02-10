// actions.ts — Server actions for admin operations
// Deps: @/lib/db/server | Used by: admin/page.tsx
'use server'

import { createServiceClient } from '@/lib/db/server'

export async function triggerFullPipeline() {
  const supabase = createServiceClient()
  const { error } = await supabase.from('pipeline_runs').insert({
    task_name: 'full-pipeline-manual',
    status: 'running' as const,
  })

  if (error) {
    return { success: false, message: `Failed to trigger pipeline: ${error.message}` }
  }

  return { success: true, message: 'Pipeline triggered' }
}

export async function getStats() {
  const supabase = createServiceClient()

  const [
    { count: totalPapers },
    { count: enrichedPapers },
    { count: embeddedPapers },
    { count: scoredPapers },
    { count: totalClusters },
  ] = await Promise.all([
    supabase.from('papers').select('*', { count: 'exact', head: true }),
    supabase.from('papers').select('*', { count: 'exact', head: true }).not('enriched_at', 'is', null),
    supabase.from('papers').select('*', { count: 'exact', head: true }).not('embedded_at', 'is', null),
    supabase.from('papers').select('*', { count: 'exact', head: true }).not('scored_at', 'is', null),
    supabase.from('clusters').select('*', { count: 'exact', head: true }),
  ])

  return {
    totalPapers: totalPapers ?? 0,
    enrichedPapers: enrichedPapers ?? 0,
    embeddedPapers: embeddedPapers ?? 0,
    scoredPapers: scoredPapers ?? 0,
    totalClusters: totalClusters ?? 0,
  }
}
