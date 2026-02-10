// check.ts — Tier-checking utility functions for paywall enforcement
// Deps: @/types/database (UserTier) | Used by: feed/page, settings/page, paywall-gate, upgrade-banner
// Centralizes all tier limit logic so feature gates are consistent across the app

import type { UserTier } from '@/types/database'

// === TYPES ===

export interface TierLimits {
  feedPapersPerDay: number
  savedPapersMax: number
  canSeeSocialBuzz: boolean
  canSeeAllGravityScores: boolean
  canUseAdvancedFilters: boolean
  canExport: boolean
  digestOptions: readonly ('daily' | 'weekly' | 'none')[]
}

// === TIER DEFINITIONS ===

export const TIER_LIMITS = {
  free: {
    feedPapersPerDay: 5,
    savedPapersMax: 10,
    canSeeSocialBuzz: false,
    canSeeAllGravityScores: false,
    canUseAdvancedFilters: false,
    canExport: false,
    digestOptions: ['weekly', 'none'] as const,
  },
  pro: {
    feedPapersPerDay: Infinity,
    savedPapersMax: Infinity,
    canSeeSocialBuzz: true,
    canSeeAllGravityScores: true,
    canUseAdvancedFilters: true,
    canExport: true,
    digestOptions: ['daily', 'weekly', 'none'] as const,
  },
  team: {
    // Same as pro for now — team adds collaboration features later
    feedPapersPerDay: Infinity,
    savedPapersMax: Infinity,
    canSeeSocialBuzz: true,
    canSeeAllGravityScores: true,
    canUseAdvancedFilters: true,
    canExport: true,
    digestOptions: ['daily', 'weekly', 'none'] as const,
  },
} as const satisfies Record<UserTier, TierLimits>

// === TIER ORDERING (for comparison) ===

const TIER_RANK: Record<UserTier, number> = {
  free: 0,
  pro: 1,
  team: 2,
}

// === EXPORTS ===

/** Get the full limits config for a tier */
export function getTierLimits(tier: UserTier): TierLimits {
  return TIER_LIMITS[tier]
}

/**
 * Check if a tier can access a boolean feature.
 * Only works for boolean feature keys — for numeric limits use getRemainingFeedViews etc.
 */
export function canAccessFeature(
  tier: UserTier,
  feature: keyof TierLimits
): boolean {
  const value = TIER_LIMITS[tier][feature]
  // Boolean features: return the value directly
  if (typeof value === 'boolean') return value
  // Numeric features: non-zero/Infinity means accessible
  if (typeof value === 'number') return value > 0
  // Array features (digestOptions): always accessible, just with different options
  return true
}

/**
 * Calculate how many more feed papers a free user can view today.
 * Returns Infinity for paid tiers.
 */
export function getRemainingFeedViews(
  tier: UserTier,
  viewedToday: number
): number {
  const limit = TIER_LIMITS[tier].feedPapersPerDay
  if (limit === Infinity) return Infinity
  return Math.max(0, limit - viewedToday)
}

/**
 * Check if a user's tier meets or exceeds the required tier.
 * Useful for paywall gates that require a minimum tier.
 */
export function meetsMinimumTier(
  userTier: UserTier,
  requiredTier: UserTier
): boolean {
  return TIER_RANK[userTier] >= TIER_RANK[requiredTier]
}
