'use client'

// mobile-nav.tsx — Hamburger menu for mobile navigation
// Deps: next/link | Used by: navbar

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

// === TYPES ===

interface MobileNavProps {
  links: { href: string; label: string }[]
}

// === MAIN COMPONENT ===

export default function MobileNav({ links }: MobileNavProps) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  return (
    <div ref={menuRef} className="md:hidden">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="rounded-md p-2 text-gray-400 transition-colors hover:bg-gray-800/50 hover:text-gray-200"
        aria-label="Toggle menu"
        aria-expanded={open}
      >
        {open ? (
          // X icon
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="h-5 w-5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        ) : (
          // Hamburger icon
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="h-5 w-5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
            />
          </svg>
        )}
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-14 z-50 border-b border-gray-800 bg-gray-950/95 backdrop-blur-md">
          <div className="mx-auto max-w-6xl px-4 py-3">
            {links.map((link) => {
              const isActive = pathname.startsWith(link.href)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={`block rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-gray-800/50 text-indigo-400'
                      : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-100'
                  }`}
                >
                  {link.label}
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
