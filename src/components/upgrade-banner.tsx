// upgrade-banner.tsx — Upgrade prompt banner (server component)
// Deps: next/link | Used by: feed/page, settings/page, paywall-gate
// Why: reusable CTA to nudge free users toward Pro — consistent styling across the app

import Link from 'next/link'

// === TYPES ===

interface UpgradeBannerProps {
  /** The feature name being gated (e.g. "Unlimited Feed") */
  feature: string
  /** Optional longer description of what they unlock */
  description?: string
  /** Compact = single-row inline banner; full = wider card with more detail */
  compact?: boolean
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

export default function UpgradeBanner({
  feature,
  description,
  compact = false,
}: UpgradeBannerProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-indigo-500/20 bg-indigo-500/5 px-4 py-3">
        <LockIcon className="h-4 w-4 shrink-0 text-indigo-400" />
        <p className="min-w-0 flex-1 text-sm text-gray-300">
          <span className="font-medium text-indigo-400">{feature}</span>
          {description && (
            <span className="text-gray-500"> — {description}</span>
          )}
        </p>
        <Link
          href="/billing"
          className="shrink-0 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-500"
        >
          Upgrade
        </Link>
      </div>
    )
  }

  // Full variant
  return (
    <div className="overflow-hidden rounded-xl border border-indigo-500/20 bg-gray-900">
      {/* Indigo gradient top accent */}
      <div className="h-1 bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-500" />

      <div className="px-6 py-5">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-500/10">
            <LockIcon className="h-5 w-5 text-indigo-400" />
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-gray-100">
              Upgrade to Pro to unlock {feature}
            </h3>
            {description ? (
              <p className="mt-1 text-sm text-gray-400">{description}</p>
            ) : (
              <p className="mt-1 text-sm text-gray-400">
                Get unlimited access to papers, daily digests, social buzz data,
                advanced filters, and more.
              </p>
            )}

            <div className="mt-4 flex items-center gap-3">
              <Link
                href="/billing"
                className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500"
              >
                Upgrade to Pro
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
              <span className="text-sm text-gray-500">Starting at $8/mo</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
