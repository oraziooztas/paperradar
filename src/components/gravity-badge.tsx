// gravity-badge.tsx — Gravity score display component
// Deps: none | Used by: paper-card, paper detail pages

import type { GravityBreakdown } from '@/types/database'

// === TYPES ===

interface GravityBadgeProps {
  score: number
  size?: 'sm' | 'md' | 'lg'
  breakdown?: GravityBreakdown
}

// === HELPERS ===

function getScoreColor(score: number): string {
  if (score >= 70) return 'text-green-500 border-green-500/30 bg-green-500/10'
  if (score >= 40) return 'text-yellow-500 border-yellow-500/30 bg-yellow-500/10'
  return 'text-red-500 border-red-500/30 bg-red-500/10'
}

const sizeStyles = {
  sm: 'w-10 h-10 text-sm',
  md: 'w-14 h-14 text-xl',
  lg: 'w-20 h-20 text-3xl',
} as const

const breakdownLabels: Record<keyof GravityBreakdown, string> = {
  novelty: 'Novelty',
  social_buzz: 'Social Buzz',
  builder_relevance: 'Builder Relevance',
  citation_velocity: 'Citation Velocity',
  author_reputation: 'Author Reputation',
  technical_depth: 'Technical Depth',
}

// === MAIN COMPONENT ===

export default function GravityBadge({
  score,
  size = 'md',
  breakdown,
}: GravityBadgeProps) {
  const colorClasses = getScoreColor(score)
  const sizeClasses = sizeStyles[size]
  const roundedScore = Math.round(score)

  return (
    <div className="group relative">
      <div
        className={`
          flex items-center justify-center rounded-full border font-mono font-bold
          ${colorClasses} ${sizeClasses}
        `}
      >
        {roundedScore}
      </div>

      {/* Tooltip with breakdown on hover */}
      {breakdown && (
        <div
          className="
            pointer-events-none absolute left-1/2 top-full z-50 mt-2
            -translate-x-1/2 rounded-lg border border-gray-800 bg-gray-900
            px-3 py-2 opacity-0 shadow-xl transition-opacity
            group-hover:pointer-events-auto group-hover:opacity-100
          "
        >
          <p className="mb-1.5 whitespace-nowrap text-xs font-semibold text-gray-300">
            Gravity Breakdown
          </p>
          <div className="space-y-1">
            {(Object.entries(breakdown) as [keyof GravityBreakdown, number | undefined][]).map(
              ([key, value]) =>
                value != null && (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-4 text-xs"
                  >
                    <span className="whitespace-nowrap text-gray-400">
                      {breakdownLabels[key]}
                    </span>
                    <span className="font-mono text-gray-200">
                      {Math.round(value)}
                    </span>
                  </div>
                )
            )}
          </div>
        </div>
      )}
    </div>
  )
}
