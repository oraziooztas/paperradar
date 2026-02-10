// full-pipeline.ts — Manual full pipeline run
// Desc: End-to-end pipeline execution for testing and admin use
// Deps: @trigger.dev/sdk/v3, all pipeline modules, @/lib/db/server
// Used by: admin dashboard, manual trigger via trigger.dev UI

import { task } from "@trigger.dev/sdk/v3"
import { ingestFromArxiv } from "@/lib/pipeline/arxiv-ingest"
import { enrichBatch } from "@/lib/pipeline/enrich"
import { embedBatch } from "@/lib/pipeline/embed"
import { updateClusters } from "@/lib/pipeline/cluster"
import { scoreBatch } from "@/lib/pipeline/score"
import { createServiceClient } from "@/lib/db/server"

// === FULL PIPELINE TASK ===

export const fullPipelineTask = task({
  id: "full-pipeline",
  retry: { maxAttempts: 1 },
  run: async () => {
    const supabase = createServiceClient()

    // Log pipeline run
    const { data: run } = await supabase
      .from("pipeline_runs")
      .insert({
        task_name: "full-pipeline",
        status: "running",
      })
      .select()
      .single()

    try {
      // Step 1: Ingest new papers from ArXiv
      console.log("[full-pipeline] Step 1/5: Ingesting from ArXiv...")
      const ingestResult = await ingestFromArxiv()
      console.log(
        `[full-pipeline] Ingested: ${ingestResult.ingested} new, ${ingestResult.skipped} skipped`
      )

      // Step 2: Enrich un-enriched papers
      console.log("[full-pipeline] Step 2/5: Enriching papers...")
      const enrichResult = await enrichBatch(50)
      console.log(
        `[full-pipeline] Enriched: ${enrichResult.enriched}, failed: ${enrichResult.failed}`
      )

      // Step 3: Embed enriched papers
      console.log("[full-pipeline] Step 3/5: Embedding papers...")
      const embedResult = await embedBatch(100)
      console.log(
        `[full-pipeline] Embedded: ${embedResult.embedded}, failed: ${embedResult.failed}`
      )

      // Step 4: Update clusters
      console.log("[full-pipeline] Step 4/5: Updating clusters...")
      const clusterResult = await updateClusters()
      console.log(
        `[full-pipeline] Clusters: ${clusterResult.created} new, ${clusterResult.updated} updated`
      )

      // Step 5: Score papers
      console.log("[full-pipeline] Step 5/5: Scoring papers...")
      const scoreResult = await scoreBatch(50)
      console.log(
        `[full-pipeline] Scored: ${scoreResult.scored}, failed: ${scoreResult.failed}`
      )

      const totalProcessed =
        ingestResult.ingested +
        enrichResult.enriched +
        embedResult.embedded +
        scoreResult.scored

      // Update pipeline run with success
      await supabase
        .from("pipeline_runs")
        .update({
          status: "completed",
          papers_processed: totalProcessed,
          completed_at: new Date().toISOString(),
        })
        .eq("id", run!.id)

      console.log("[full-pipeline] Pipeline complete!")

      return {
        ingest: ingestResult,
        enrich: enrichResult,
        embed: embedResult,
        cluster: clusterResult,
        score: scoreResult,
      }
    } catch (error) {
      await supabase
        .from("pipeline_runs")
        .update({
          status: "failed",
          error_message:
            error instanceof Error ? error.message : "Unknown error",
          completed_at: new Date().toISOString(),
        })
        .eq("id", run!.id)

      throw error
    }
  },
})
