// route.ts — Manual pipeline trigger API
// Deps: pipeline modules, @/lib/db/server | Used by: admin dashboard, testing
// Why: allows running pipeline steps without trigger.dev for local development

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/db/server'
import { ingestFromArxiv } from '@/lib/pipeline/arxiv-ingest'
import { enrichBatch } from '@/lib/pipeline/enrich'
import { embedBatch } from '@/lib/pipeline/embed'
import { updateClusters } from '@/lib/pipeline/cluster'
import { scoreBatch } from '@/lib/pipeline/score'

type PipelineStep = 'ingest' | 'enrich' | 'embed' | 'cluster' | 'score' | 'all'

export async function POST(request: Request) {
  const { step = 'all' } = (await request.json()) as { step?: PipelineStep }

  const supabase = createServiceClient()
  const { data: run } = await supabase
    .from('pipeline_runs')
    .insert({ task_name: `manual-${step}`, status: 'running' })
    .select()
    .single()

  try {
    const results: Record<string, unknown> = {}

    if (step === 'ingest' || step === 'all') {
      results.ingest = await ingestFromArxiv()
    }
    if (step === 'enrich' || step === 'all') {
      results.enrich = await enrichBatch(20)
    }
    if (step === 'embed' || step === 'all') {
      results.embed = await embedBatch(50)
    }
    if (step === 'cluster' || step === 'all') {
      results.cluster = await updateClusters()
    }
    if (step === 'score' || step === 'all') {
      results.score = await scoreBatch(20)
    }

    await supabase
      .from('pipeline_runs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', run!.id)

    return NextResponse.json({ success: true, results })
  } catch (error) {
    await supabase
      .from('pipeline_runs')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        completed_at: new Date().toISOString(),
      })
      .eq('id', run!.id)

    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
