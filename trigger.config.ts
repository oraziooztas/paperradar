import type { TriggerConfig } from "@trigger.dev/sdk/v3"

export const config: TriggerConfig = {
  project: "paperradar",
  logLevel: "log",
  // Pipeline tasks can be long-running (ArXiv fetching, AI enrichment, embedding)
  // 300 seconds = 5 minutes max per task execution
  maxDuration: 300,
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
    },
  },
  dirs: ["./src/trigger"],
}
