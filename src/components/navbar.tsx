// navbar.tsx — Main navigation bar (server component)
// Deps: @/lib/db/server, user-menu, next/link | Used by: (main)/layout.tsx

import Link from 'next/link'
import { createServerComponentClient } from '@/lib/db/server'
import UserMenu from '@/components/user-menu'
import MobileNav from '@/components/mobile-nav'

// === TYPES ===

interface NavLink {
  href: string
  label: string
}

const navLinks: NavLink[] = [
  { href: '/feed', label: 'Feed' },
  { href: '/trending', label: 'Trending' },
  { href: '/clusters', label: 'Clusters' },
]

// === MAIN COMPONENT ===

export default async function Navbar() {
  const supabase = await createServerComponentClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Fetch profile for display name and avatar if authenticated
  let displayName = ''
  let avatarUrl: string | null = null
  let email = ''

  if (user) {
    email = user.email ?? ''
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, avatar_url')
      .eq('id', user.id)
      .single()

    displayName = profile?.display_name ?? email.split('@')[0]
    avatarUrl = profile?.avatar_url ?? null
  }

  return (
    <header className="sticky top-0 z-40 border-b border-gray-800 bg-gray-950/80 backdrop-blur-md">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Left: Logo */}
        <Link
          href="/feed"
          className="flex items-center gap-2 text-gray-100 transition-colors hover:text-white"
        >
          {/* Radar icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            className="h-6 w-6 text-indigo-500"
          >
            <circle cx="12" cy="12" r="10" strokeOpacity="0.3" />
            <circle cx="12" cy="12" r="6" strokeOpacity="0.5" />
            <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
            <line x1="12" y1="12" x2="18" y2="6" strokeLinecap="round" />
          </svg>
          <span className="text-lg font-bold tracking-tight">PaperRadar</span>
        </Link>

        {/* Center: Nav links (desktop) */}
        <div className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <NavItem key={link.href} href={link.href} label={link.label} />
          ))}
        </div>

        {/* Right: User menu or Sign In */}
        <div className="flex items-center gap-3">
          {user ? (
            <UserMenu
              displayName={displayName}
              avatarUrl={avatarUrl}
              email={email}
            />
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
            >
              Sign in
            </Link>
          )}

          {/* Mobile hamburger */}
          <MobileNav links={navLinks} />
        </div>
      </nav>
    </header>
  )
}

// === NAV ITEM (server component) ===

function NavItem({ href, label }: NavLink) {
  return (
    <Link
      href={href}
      className="
        group relative rounded-md px-3 py-2 text-sm font-medium
        text-gray-400 transition-colors hover:text-gray-100
      "
    >
      {label}
      {/* Active indicator — will be enhanced with usePathname in a client wrapper if needed */}
      <span className="absolute inset-x-1 -bottom-[calc(0.5rem+1px)] h-0.5 scale-x-0 rounded-full bg-indigo-500 transition-transform group-hover:scale-x-100" />
    </Link>
  )
}
