// layout.tsx — Admin layout with header
// Deps: none | Used by: admin pages

import Link from 'next/link'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-950">
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-100">PaperRadar Admin</h1>
            <p className="text-sm text-gray-500">Pipeline monitoring &amp; management</p>
          </div>
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">
            &larr; Back to app
          </Link>
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  )
}
