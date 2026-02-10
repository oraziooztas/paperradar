// score-papers.ts — Paper scoring tasks
// Desc: Scheduled scoring of new papers (every 30m) + daily rescore of stale papers
// Deps: @trigger.dev/sdk/v3, @/lib/pipeline/score, @/lib/db/server
// Used by: trigger.dev scheduler

import { schedules } from "@trigger.dev/sdk/v3"
import { scoreBatch, rescoreStale } from "@/lib/pipeline/score"
import { createServiceClient } from "@/lib/db/server"

// === SCHEDULED SCORING — New papers every 30 minutes ===

export const scorePapersSchedule = schedules.task({
  id: "score-papers-schedule",
  // Every 30 minutes
  cron: "*/30 * * * *",
  run: async () => {
    const supabase = createServiceClient()

    const { data: run } = await supabase
      .from("pipeline_runs")
      .insert({
        task_name: "score-papers",
        status: "running",
      })
      .select()
      .single()

    try {
      const result = await scoreBatch(50)

      await supabase
        .from("pipeline_runs")
        .update({
          status: "completed",
          papers_processed: result.scored,
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

// === DAILY RESCORE — Refresh stale gravity scores every 24 hours ===

export const rescoreStaleSchedule = schedules.task({
  id: "rescore-stale-papers",
  // Every day at 3:00 AM UTC — off-peak hours
  cron: "0 3 * * *",
  run: async () => {
    const supabase = createServiceClient()

    const { data: run } = await supabase
      .from("pipeline_runs")
      .insert({
        task_name: "rescore-stale-papers",
        status: "running",
      })
      .select()
      .single()

    try {
      const result = await rescoreStale()

      await supabase
        .from("pipeline_runs")
        .update({
          status: "completed",
          papers_processed: result.rescored,
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
