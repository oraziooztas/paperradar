'use client'

// save-button.tsx — Client component for save/unsave paper
// Deps: @/lib/db/supabase, react | Used by: paper-card, paper detail pages

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/db/supabase'
import { useRouter } from 'next/navigation'

// === TYPES ===

interface SaveButtonProps {
  paperId: string
  initialSaved: boolean
}

// === MAIN COMPONENT ===

export default function SaveButton({ paperId, initialSaved }: SaveButtonProps) {
  const [saved, setSaved] = useState(initialSaved)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleToggle() {
    // Optimistic UI update
    setSaved((prev) => !prev)

    startTransition(async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        // Revert optimistic update — user not authenticated
        setSaved(initialSaved)
        router.push('/login')
        return
      }

      if (saved) {
        // Unsave
        const { error } = await supabase
          .from('saved_papers')
          .delete()
          .eq('user_id', user.id)
          .eq('paper_id', paperId)

        if (error) {
          // Revert on failure
          setSaved(true)
        }
      } else {
        // Save
        const { error } = await supabase
          .from('saved_papers')
          .insert({ user_id: user.id, paper_id: paperId })

        if (error) {
          // Revert on failure
          setSaved(false)
        }
      }

      router.refresh()
    })
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      className={`
        inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm
        transition-colors disabled:opacity-50
        ${
          saved
            ? 'text-indigo-400 hover:text-indigo-300'
            : 'text-gray-500 hover:text-gray-300'
        }
      `}
      aria-label={saved ? 'Unsave paper' : 'Save paper'}
    >
      {/* Bookmark icon — filled when saved, outline when not */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill={saved ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={saved ? 0 : 1.5}
        className="h-5 w-5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z"
        />
      </svg>
      <span className="hidden sm:inline">{saved ? 'Saved' : 'Save'}</span>
    </button>
  )
}
