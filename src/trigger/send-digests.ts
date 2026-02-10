// send-digests.ts — Scheduled digest email tasks
// Desc: Cron tasks for daily and weekly digest emails
// Deps: @trigger.dev/sdk/v3, @/lib/email/send-digest, @/lib/db/server
// Used by: trigger.dev scheduler

import { schedules } from "@trigger.dev/sdk/v3"
import { sendBatchDigests } from "@/lib/email/send-digest"
import { createServiceClient } from "@/lib/db/server"

// === DAILY DIGEST — Every day at 8:00 AM UTC ===

export const sendDailyDigests = schedules.task({
  id: "send-daily-digests",
  cron: "0 8 * * *",
  run: async () => {
    const supabase = createServiceClient()

    const { data: run } = await supabase
      .from("pipeline_runs")
      .insert({
        task_name: "send-daily-digests",
        status: "running",
      })
      .select()
      .single()

    try {
      const stats = await sendBatchDigests("daily")

      await supabase
        .from("pipeline_runs")
        .update({
          status: "completed",
          papers_processed: stats.sent,
          completed_at: new Date().toISOString(),
        })
        .eq("id", run!.id)

      console.log("[send-daily-digests] Complete:", stats)
      return stats
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

// === WEEKLY DIGEST — Every Monday at 8:00 AM UTC ===

export const sendWeeklyDigests = schedules.task({
  id: "send-weekly-digests",
  cron: "0 8 * * 1",
  run: async () => {
    const supabase = createServiceClient()

    const { data: run } = await supabase
      .from("pipeline_runs")
      .insert({
        task_name: "send-weekly-digests",
        status: "running",
      })
      .select()
      .single()

    try {
      const stats = await sendBatchDigests("weekly")

      await supabase
        .from("pipeline_runs")
        .update({
          status: "completed",
          papers_processed: stats.sent,
          completed_at: new Date().toISOString(),
        })
        .eq("id", run!.id)

      console.log("[send-weekly-digests] Complete:", stats)
      return stats
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
