// enrich-papers.ts — Paper enrichment tasks
// Desc: Scheduled batch enrichment + on-demand single paper enrichment
// Deps: @trigger.dev/sdk/v3, @/lib/pipeline/enrich, @/lib/db/server
// Used by: trigger.dev scheduler, manual triggers

import { schedules, task } from "@trigger.dev/sdk/v3"
import { enrichBatch, enrichPaper } from "@/lib/pipeline/enrich"
import { createServiceClient } from "@/lib/db/server"

// === SCHEDULED BATCH ENRICHMENT ===

export const enrichPapersSchedule = schedules.task({
  id: "enrich-papers-schedule",
  // Every 30 minutes
  cron: "*/30 * * * *",
  run: async () => {
    const supabase = createServiceClient()

    const { data: run } = await supabase
      .from("pipeline_runs")
      .insert({
        task_name: "enrich-papers",
        status: "running",
      })
      .select()
      .single()

    try {
      const result = await enrichBatch(20)

      await supabase
        .from("pipeline_runs")
        .update({
          status: "completed",
          papers_processed: result.enriched,
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

// === SINGLE PAPER ENRICHMENT (on-demand) ===

export const enrichSinglePaper = task({
  id: "enrich-single-paper",
  retry: { maxAttempts: 2 },
  run: async ({ paperId }: { paperId: string }) => {
    await enrichPaper(paperId)
    return { paperId, status: "enriched" as const }
  },
})
