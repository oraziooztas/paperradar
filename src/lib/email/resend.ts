// resend.ts — Resend client singleton and email constants
// Deps: resend, @/lib/env | Used by: send-digest.ts, welcome email sender

import { Resend } from 'resend'
import { getServerEnv } from '@/lib/env'

// === CONSTANTS ===

export const FROM_EMAIL = 'PaperRadar <digest@paperradar.com>'
export const REPLY_TO = 'support@paperradar.com'

// === CLIENT SINGLETON ===

let _resend: Resend | null = null

/**
 * Lazily creates and returns a Resend client instance.
 * Uses the RESEND_API_KEY from validated server environment.
 */
export function getResend(): Resend {
  if (!_resend) {
    const apiKey = getServerEnv().RESEND_API_KEY
    if (!apiKey) {
      throw new Error('[email] RESEND_API_KEY is not configured')
    }
    _resend = new Resend(apiKey)
  }
  return _resend
}
