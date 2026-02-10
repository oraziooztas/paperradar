// client.ts — Stripe SDK singleton for server-side usage
// Deps: stripe, @/lib/env | Used by: API routes (checkout, portal, webhook)

import Stripe from 'stripe'
import { getServerEnv } from '@/lib/env'

// === SINGLETON ===

let _stripe: Stripe | null = null

/**
 * Lazily creates and returns a Stripe SDK instance.
 * Uses the secret key from validated server environment.
 * Throws if STRIPE_SECRET_KEY is not configured.
 */
export function getStripe(): Stripe {
  if (!_stripe) {
    const env = getServerEnv()

    if (!env.STRIPE_SECRET_KEY) {
      throw new Error(
        'STRIPE_SECRET_KEY is not configured. Set it in your environment variables.'
      )
    }

    _stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      // Use the version matching the installed stripe@20.3.1 types
      apiVersion: '2026-01-28.clover',
      typescript: true,
    })
  }

  return _stripe
}
