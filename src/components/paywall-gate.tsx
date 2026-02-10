'use client'

// paywall-gate.tsx — Client component that wraps content requiring a paid tier
// Deps: react, @/lib/paywall/check, @/components/upgrade-banner | Used by: any page gating pro features
// Why: shows a blurred teaser of the content with an overlay upgrade prompt

import type { ReactNode } from 'react'
import type { UserTier } from '@/types/database'
import { meetsMinimumTier } from '@/lib/paywall/check'
import Link from 'next/link'

// === TYPES ===

interface PaywallGateProps {
  /** The user's current tier */
  tier: UserTier
  /** The minimum tier required to see this content */
  requiredTier: UserTier
  /** Feature name shown in the upgrade prompt */
  feature: string
  /** The content to show (blurred if gated) */
  children: ReactNode
}

// === LOCK ICON ===

function LockIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path
        fillRule="evenodd"
        d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3c0-2.9-2.35-5.25-5.25-5.25Zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

// === MAIN COMPONENT ===

export default function PaywallGate({
  tier,
  requiredTier,
  feature,
  children,
}: PaywallGateProps) {
  // User meets the required tier — render children normally
  if (meetsMinimumTier(tier, requiredTier)) {
    return <>{children}</>
  }

  // User does NOT meet the required tier — show blurred teaser with upgrade overlay
  return (
    <div className="relative">
      {/* Blurred content — visible but not readable/interactable */}
      <div
        className="select-none pointer-events-none"
        style={{ filter: 'blur(8px)' }}
        aria-hidden="true"
      >
        {children}
      </div>

      {/* Overlay with upgrade prompt */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="mx-4 max-w-sm overflow-hidden rounded-xl border border-indigo-500/20 bg-gray-900/95 shadow-2xl backdrop-blur-sm">
          {/* Indigo gradient top accent */}
          <div className="h-1 bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-500" />

          <div className="px-6 py-5 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500/10">
              <LockIcon className="h-5 w-5 text-indigo-400" />
            </div>

            <h3 className="text-base font-semibold text-gray-100">
              {feature}
            </h3>
            <p className="mt-1 text-sm text-gray-400">
              Upgrade to {requiredTier === 'team' ? 'Team' : 'Pro'} to unlock
              this feature.
            </p>

            <Link
              href="/billing"
              className="mt-4 inline-flex items-center rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500"
            >
              Upgrade to {requiredTier === 'team' ? 'Team' : 'Pro'}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="ml-1.5 h-4 w-4"
              >
                <path
                  fillRule="evenodd"
                  d="M3 10a.75.75 0 0 1 .75-.75h10.638l-3.96-4.158a.75.75 0 1 1 1.08-1.04l5.25 5.5a.75.75 0 0 1 0 1.04l-5.25 5.5a.75.75 0 1 1-1.08-1.04l3.96-4.158H3.75A.75.75 0 0 1 3 10Z"
                  clipRule="evenodd"
                />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
