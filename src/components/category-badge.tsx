// category-badge.tsx — Category and difficulty badge components
// Deps: @/types/database (Difficulty) | Used by: paper-card, paper detail pages

import type { Difficulty } from '@/types/database'

// === TYPES ===

interface CategoryBadgeProps {
  category: string
}

interface DifficultyBadgeProps {
  difficulty: Difficulty
}

// === HELPERS ===

const difficultyConfig: Record<
  Difficulty,
  { label: string; classes: string }
> = {
  beginner: {
    label: 'Beginner',
    classes: 'text-green-400 bg-green-500/10 border-green-500/20',
  },
  intermediate: {
    label: 'Intermediate',
    classes: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  },
  advanced: {
    label: 'Advanced',
    classes: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  },
  expert: {
    label: 'Expert',
    classes: 'text-red-400 bg-red-500/10 border-red-500/20',
  },
}

// === COMPONENTS ===

export function CategoryBadge({ category }: CategoryBadgeProps) {
  return (
    <span className="inline-flex items-center rounded-full border border-gray-700 bg-gray-800 px-2.5 py-0.5 text-xs font-medium text-gray-400">
      {category}
    </span>
  )
}

export function DifficultyBadge({ difficulty }: DifficultyBadgeProps) {
  const config = difficultyConfig[difficulty]

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${config.classes}`}
    >
      {config.label}
    </span>
  )
}
