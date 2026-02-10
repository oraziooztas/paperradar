// config.ts — Stripe product/price configuration and tier mapping
// Deps: @/types/database | Used by: checkout route, webhook handler

import type { UserTier } from '@/types/database'

// === PRICE & PORTAL CONFIGURATION ===

export const STRIPE_CONFIG = {
  prices: {
    pro_monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID ?? '',
    pro_yearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID ?? '',
    team_monthly: process.env.STRIPE_TEAM_MONTHLY_PRICE_ID ?? '',
    team_yearly: process.env.STRIPE_TEAM_YEARLY_PRICE_ID ?? '',
  },
  portalConfigId: process.env.STRIPE_PORTAL_CONFIG_ID ?? '',
} as const

// === TIER MAPPING ===

/**
 * Maps a Stripe price ID back to the corresponding UserTier.
 * Used by the webhook handler to determine which tier to assign
 * when a subscription is created or updated.
 */
export function tierFromPriceId(priceId: string): UserTier {
  const { prices } = STRIPE_CONFIG

  if (priceId === prices.pro_monthly || priceId === prices.pro_yearly) {
    return 'pro'
  }

  if (priceId === prices.team_monthly || priceId === prices.team_yearly) {
    return 'team'
  }

  // Unknown price — default to free (safe fallback)
  return 'free'
}

/**
 * Alias for tierFromPriceId — kept for API consistency.
 */
export function getTierForProduct(priceId: string): UserTier {
  return tierFromPriceId(priceId)
}
