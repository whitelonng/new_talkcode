// docs/app/share/[id]/loading.tsx
// Loading skeleton for share page

export default function ShareLoading() {
  return (
    <div className="min-h-screen animate-pulse">
      {/* Header skeleton */}
      <header className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-6 w-6 rounded bg-gray-200 dark:bg-gray-800" />
              <div className="h-5 w-24 rounded bg-gray-200 dark:bg-gray-800" />
            </div>
            <div className="h-9 w-32 rounded-lg bg-gray-200 dark:bg-gray-800" />
          </div>
        </div>
      </header>

      {/* Content skeleton */}
      <main className="mx-auto max-w-4xl px-4 py-6">
        {/* Title card skeleton */}
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-4 h-8 w-3/4 rounded bg-gray-200 dark:bg-gray-800" />
          <div className="flex gap-4">
            <div className="h-5 w-32 rounded bg-gray-200 dark:bg-gray-800" />
            <div className="h-5 w-24 rounded bg-gray-200 dark:bg-gray-800" />
          </div>
        </div>

        {/* Messages skeleton */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={`flex gap-4 px-6 py-5 ${
                i % 2 === 1 ? 'bg-gray-50 dark:bg-gray-800/50' : ''
              }`}
            >
              <div className="h-8 w-8 flex-shrink-0 rounded-full bg-gray-200 dark:bg-gray-700" />
              <div className="flex-1 space-y-3">
                <div className="h-4 w-20 rounded bg-gray-200 dark:bg-gray-700" />
                <div className="space-y-2">
                  <div className="h-4 w-full rounded bg-gray-200 dark:bg-gray-700" />
                  <div className="h-4 w-5/6 rounded bg-gray-200 dark:bg-gray-700" />
                  <div className="h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-700" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
