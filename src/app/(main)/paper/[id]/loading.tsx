// loading.tsx — Loading skeleton for /paper/[id]
// Deps: none (Tailwind animate-pulse) | Used by: Next.js Suspense boundary

export default function PaperLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 animate-pulse">
      {/* Back link skeleton */}
      <div className="mb-6 h-4 w-28 rounded bg-gray-800" />

      {/* Gravity score + breakdown skeleton */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
        <div className="flex items-center gap-3">
          <div className="h-20 w-20 rounded-full bg-gray-800" />
          <div className="h-4 w-24 rounded bg-gray-800" />
        </div>
        <div className="flex-1 rounded-lg border border-gray-800 bg-gray-900 p-4 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-3 w-16 rounded bg-gray-800" />
              <div className="h-3 flex-1 rounded-full bg-gray-800" />
              <div className="h-3 w-8 rounded bg-gray-800" />
            </div>
          ))}
        </div>
      </div>

      {/* Title skeleton */}
      <div className="mb-6">
        <div className="h-8 w-3/4 rounded bg-gray-800 mb-3" />
        <div className="h-5 w-1/2 rounded bg-gray-800 mb-2" />
        <div className="flex gap-2">
          <div className="h-5 w-16 rounded-full bg-gray-800" />
          <div className="h-5 w-14 rounded-full bg-gray-800" />
          <div className="h-5 w-20 rounded bg-gray-800" />
        </div>
      </div>

      {/* Action buttons skeleton */}
      <div className="mb-8 flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-8 w-20 rounded-md bg-gray-800" />
        ))}
      </div>

      {/* Content sections skeleton */}
      <div className="space-y-8">
        {/* TLDR */}
        <div>
          <div className="flex items-center gap-3">
            <div className="h-4 w-12 rounded bg-gray-800" />
            <div className="h-px flex-1 bg-gray-800" />
          </div>
          <div className="mt-3 space-y-2">
            <div className="h-4 w-full rounded bg-gray-800" />
            <div className="h-4 w-5/6 rounded bg-gray-800" />
          </div>
        </div>

        {/* Key Findings */}
        <div>
          <div className="flex items-center gap-3">
            <div className="h-4 w-24 rounded bg-gray-800" />
            <div className="h-px flex-1 bg-gray-800" />
          </div>
          <div className="mt-3 space-y-2">
            <div className="h-4 w-full rounded bg-gray-800" />
            <div className="h-4 w-4/5 rounded bg-gray-800" />
            <div className="h-4 w-3/4 rounded bg-gray-800" />
          </div>
        </div>

        {/* Novelty */}
        <div>
          <div className="flex items-center gap-3">
            <div className="h-4 w-32 rounded bg-gray-800" />
            <div className="h-px flex-1 bg-gray-800" />
          </div>
          <div className="mt-3 space-y-2">
            <div className="h-4 w-full rounded bg-gray-800" />
            <div className="h-4 w-4/6 rounded bg-gray-800" />
          </div>
        </div>

        {/* Practical */}
        <div>
          <div className="flex items-center gap-3">
            <div className="h-4 w-36 rounded bg-gray-800" />
            <div className="h-px flex-1 bg-gray-800" />
          </div>
          <div className="mt-3 space-y-2">
            <div className="h-4 w-full rounded bg-gray-800" />
            <div className="h-4 w-5/6 rounded bg-gray-800" />
          </div>
        </div>

        {/* Social signals */}
        <div>
          <div className="flex items-center gap-3">
            <div className="h-4 w-28 rounded bg-gray-800" />
            <div className="h-px flex-1 bg-gray-800" />
          </div>
          <div className="mt-3 space-y-2">
            <div className="h-10 w-full rounded-md bg-gray-800" />
            <div className="h-10 w-full rounded-md bg-gray-800" />
          </div>
        </div>
      </div>
    </div>
  )
}
