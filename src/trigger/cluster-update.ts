// cluster-update.ts — Scheduled clustering update task
// Desc: Runs cluster analysis on embedded papers every hour
// Deps: @trigger.dev/sdk/v3, @/lib/pipeline/cluster, @/lib/db/server
// Used by: trigger.dev scheduler

import { schedules } from "@trigger.dev/sdk/v3"
import { updateClusters } from "@/lib/pipeline/cluster"
import { createServiceClient } from "@/lib/db/server"

// === SCHEDULED CLUSTER UPDATE ===

export const clusterUpdateSchedule = schedules.task({
  id: "cluster-update",
  // Every hour
  cron: "0 * * * *",
  run: async () => {
    const supabase = createServiceClient()

    const { data: run } = await supabase
      .from("pipeline_runs")
      .insert({
        task_name: "cluster-update",
        status: "running",
      })
      .select()
      .single()

    try {
      const result = await updateClusters()

      await supabase
        .from("pipeline_runs")
        .update({
          status: "completed",
          papers_processed: result.created + result.updated,
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
