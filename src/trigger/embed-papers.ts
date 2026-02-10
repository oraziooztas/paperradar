// embed-papers.ts — Paper embedding tasks
// Desc: Scheduled batch embedding + on-demand single paper embedding
// Deps: @trigger.dev/sdk/v3, @/lib/pipeline/embed, @/lib/db/server
// Used by: trigger.dev scheduler, manual triggers

import { schedules, task } from "@trigger.dev/sdk/v3"
import { embedBatch, embedPaper } from "@/lib/pipeline/embed"
import { createServiceClient } from "@/lib/db/server"

// === SCHEDULED BATCH EMBEDDING ===

export const embedPapersSchedule = schedules.task({
  id: "embed-papers-schedule",
  // Every 30 minutes
  cron: "*/30 * * * *",
  run: async () => {
    const supabase = createServiceClient()

    const { data: run } = await supabase
      .from("pipeline_runs")
      .insert({
        task_name: "embed-papers",
        status: "running",
      })
      .select()
      .single()

    try {
      const result = await embedBatch(50)

      await supabase
        .from("pipeline_runs")
        .update({
          status: "completed",
          papers_processed: result.embedded,
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

// === SINGLE PAPER EMBEDDING (on-demand) ===

export const embedSinglePaper = task({
  id: "embed-single-paper",
  retry: { maxAttempts: 2 },
  run: async ({ paperId }: { paperId: string }) => {
    await embedPaper(paperId)
    return { paperId, status: "embedded" as const }
  },
})
