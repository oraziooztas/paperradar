import { describe, it, expect } from 'vitest'
import {
  TIER_LIMITS,
  getTierLimits,
  canAccessFeature,
  getRemainingFeedViews,
  meetsMinimumTier,
} from '@/lib/paywall/check'

describe('getTierLimits', () => {
  it('returns the free-tier caps', () => {
    const free = getTierLimits('free')
    expect(free.feedPapersPerDay).toBe(5)
    expect(free.savedPapersMax).toBe(10)
    expect(free.canSeeSocialBuzz).toBe(false)
    expect(free.canExport).toBe(false)
    expect(free.digestOptions).toEqual(['weekly', 'none'])
  })

  it('unlocks everything on pro (unbounded numeric limits)', () => {
    const pro = getTierLimits('pro')
    expect(pro.feedPapersPerDay).toBe(Infinity)
    expect(pro.savedPapersMax).toBe(Infinity)
    expect(pro.canSeeSocialBuzz).toBe(true)
    expect(pro.canExport).toBe(true)
    expect(pro.digestOptions).toContain('daily')
  })

  it('grants team at least everything pro has', () => {
    const team = getTierLimits('team')
    expect(team.feedPapersPerDay).toBe(Infinity)
    expect(team.canSeeAllGravityScores).toBe(true)
    expect(team.canUseAdvancedFilters).toBe(true)
  })
})

describe('canAccessFeature', () => {
  it('returns boolean feature flags directly', () => {
    expect(canAccessFeature('free', 'canSeeSocialBuzz')).toBe(false)
    expect(canAccessFeature('pro', 'canSeeSocialBuzz')).toBe(true)
    expect(canAccessFeature('free', 'canUseAdvancedFilters')).toBe(false)
    expect(canAccessFeature('pro', 'canExport')).toBe(true)
  })

  it('treats positive numeric limits as accessible', () => {
    expect(canAccessFeature('free', 'feedPapersPerDay')).toBe(true)
    expect(canAccessFeature('free', 'savedPapersMax')).toBe(true)
    expect(canAccessFeature('pro', 'feedPapersPerDay')).toBe(true)
  })

  it('treats array-valued features (digestOptions) as accessible', () => {
    expect(canAccessFeature('free', 'digestOptions')).toBe(true)
    expect(canAccessFeature('pro', 'digestOptions')).toBe(true)
  })
})

describe('getRemainingFeedViews', () => {
  it('counts down from the free-tier daily cap', () => {
    expect(getRemainingFeedViews('free', 0)).toBe(5)
    expect(getRemainingFeedViews('free', 3)).toBe(2)
    expect(getRemainingFeedViews('free', 5)).toBe(0)
  })

  it('never returns a negative number once the cap is exceeded', () => {
    expect(getRemainingFeedViews('free', 7)).toBe(0)
  })

  it('is unbounded for paid tiers regardless of views', () => {
    expect(getRemainingFeedViews('pro', 100)).toBe(Infinity)
    expect(getRemainingFeedViews('team', 9999)).toBe(Infinity)
  })
})

describe('meetsMinimumTier', () => {
  it('lets a tier satisfy its own requirement', () => {
    expect(meetsMinimumTier('free', 'free')).toBe(true)
    expect(meetsMinimumTier('pro', 'pro')).toBe(true)
    expect(meetsMinimumTier('team', 'team')).toBe(true)
  })

  it('lets a higher tier satisfy a lower requirement', () => {
    expect(meetsMinimumTier('pro', 'free')).toBe(true)
    expect(meetsMinimumTier('team', 'pro')).toBe(true)
    expect(meetsMinimumTier('team', 'free')).toBe(true)
  })

  it('rejects a lower tier against a higher requirement', () => {
    expect(meetsMinimumTier('free', 'pro')).toBe(false)
    expect(meetsMinimumTier('free', 'team')).toBe(false)
    expect(meetsMinimumTier('pro', 'team')).toBe(false)
  })
})

describe('TIER_LIMITS invariants', () => {
  it('makes paid tiers at least as permissive as free', () => {
    expect(TIER_LIMITS.pro.feedPapersPerDay).toBeGreaterThan(
      TIER_LIMITS.free.feedPapersPerDay
    )
    expect(TIER_LIMITS.pro.savedPapersMax).toBeGreaterThan(
      TIER_LIMITS.free.savedPapersMax
    )
  })

  it('keeps premium-only flags off for free', () => {
    expect(TIER_LIMITS.free.canSeeSocialBuzz).toBe(false)
    expect(TIER_LIMITS.free.canSeeAllGravityScores).toBe(false)
    expect(TIER_LIMITS.free.canExport).toBe(false)
  })
})
