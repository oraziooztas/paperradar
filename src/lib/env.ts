// env.ts — Zod-validated environment configuration
// Deps: zod | Used by: all server/client code needing env vars

import { z } from 'zod'

// === CLIENT ENV (NEXT_PUBLIC_ vars safe for browser) ===

const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
})

// === SERVER ENV (all vars, including secrets — never expose to client) ===

const serverEnvSchema = clientEnvSchema.extend({
  // Supabase admin
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // AI — required for pipeline
  OPENAI_API_KEY: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),

  // trigger.dev
  TRIGGER_API_KEY: z.string().optional(),
  TRIGGER_API_URL: z.string().url().optional(),

  // External APIs
  REDDIT_CLIENT_ID: z.string().optional(),
  REDDIT_CLIENT_SECRET: z.string().optional(),
  TAVILY_API_KEY: z.string().optional(),

  // Email
  RESEND_API_KEY: z.string().optional(),

  // Stripe
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
})

// === EXPORTS ===

/**
 * Client-safe env vars (only NEXT_PUBLIC_ prefixed).
 * Parsed lazily on first access to avoid build-time crashes
 * when server-only vars aren't available in the browser bundle.
 */
let _clientEnv: z.infer<typeof clientEnvSchema> | null = null

export function getClientEnv() {
  if (!_clientEnv) {
    _clientEnv = clientEnvSchema.parse({
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    })
  }
  return _clientEnv
}

/**
 * Full env including secrets. Only call from server code
 * (API routes, server components, pipeline jobs).
 * Parsed lazily — crashes with a clear Zod error if required vars are missing.
 */
let _serverEnv: z.infer<typeof serverEnvSchema> | null = null

export function getServerEnv() {
  if (!_serverEnv) {
    _serverEnv = serverEnvSchema.parse(process.env)
  }
  return _serverEnv
}

// Re-export types for convenience
export type ClientEnv = z.infer<typeof clientEnvSchema>
export type ServerEnv = z.infer<typeof serverEnvSchema>
