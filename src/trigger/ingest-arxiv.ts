// ingest-arxiv.ts — Scheduled ArXiv ingestion task
// Desc: Cron task that fetches new papers from ArXiv every 2 hours
// Deps: @trigger.dev/sdk/v3, @/lib/pipeline/arxiv-ingest, @/lib/db/server
// Used by: trigger.dev scheduler

import { schedules } from "@trigger.dev/sdk/v3"
import { ingestFromArxiv } from "@/lib/pipeline/arxiv-ingest"
import { createServiceClient } from "@/lib/db/server"

export const ingestArxivTask = schedules.task({
  id: "ingest-arxiv",
  // Every 2 hours
  cron: "0 */2 * * *",
  run: async () => {
    const supabase = createServiceClient()

    // Log pipeline run start
    const { data: run } = await supabase
      .from("pipeline_runs")
      .insert({
        task_name: "ingest-arxiv",
        status: "running",
      })
      .select()
      .single()

    try {
      const result = await ingestFromArxiv()

      // Update pipeline run with success
      await supabase
        .from("pipeline_runs")
        .update({
          status: "completed",
          papers_processed: result.ingested,
          completed_at: new Date().toISOString(),
        })
        .eq("id", run!.id)

      return result
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
