// layout.tsx — Main app layout for authenticated pages
// Deps: @/components/navbar | Used by: /feed, /paper/*, /cluster/*, /settings, /trending

import Navbar from '@/components/navbar'

// === MAIN LAYOUT ===

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col bg-gray-950">
      <Navbar />

      {/* Main content */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 bg-gray-950">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 sm:flex-row sm:px-6">
          <p className="text-sm text-gray-500">
            PaperRadar &mdash; AI Research Intelligence
          </p>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-gray-400"
            >
              GitHub
            </a>
            <a
              href="/about"
              className="transition-colors hover:text-gray-400"
            >
              About
            </a>
            <a
              href="/privacy"
              className="transition-colors hover:text-gray-400"
            >
              Privacy
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
