import { useState } from 'react'
import { SignupForm } from '../components/SignupForm'
import { SuccessMessage } from '../components/SuccessMessage'
import { ErrorMessage } from '../components/ErrorMessage'
import { useStats } from '../hooks/useStats'
import { useLatestSummary } from '../hooks/useLatestSummary'
import { LatestDigestPreview } from '../components/LatestDigestPreview'
import { RecentIssues } from '../components/RecentIssues'

export function HomePage() {
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const { totalSubscribers, totalSummaries, isLoading: statsLoading } = useStats()
  const { summary: latestSummary, isLoading: latestLoading } = useLatestSummary()

  const clearMessages = () => {
    setSuccessMessage(null)
    setErrorMessage(null)
  }

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-white dark:bg-transparent border-b border-surface-border dark:border-transparent">
        <div className="absolute inset-0 bg-grid-pattern dark:bg-grid-pattern-dark bg-grid opacity-50" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-white dark:from-surface-dark to-transparent" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
          <div className="grid lg:grid-cols-2 gap-12 items-start">
            <div>
              <p className="eyebrow mb-4">pgsql-hackers, distilled</p>
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900 dark:text-white leading-tight mb-6">
                600+ mailing list posts a week.{' '}
                <span className="text-pg-700 dark:text-accent-400">The 10 most active discussions, summarized.</span>
              </h1>
              <p className="text-lg text-gray-600 dark:text-gray-400 mb-8 max-w-lg">
                AI summaries of the threads the PostgreSQL community is talking about most,
                every Friday in your inbox.
              </p>

              <div className="max-w-md">
                {successMessage && <SuccessMessage message={successMessage} onClose={clearMessages} />}
                {errorMessage && <ErrorMessage message={errorMessage} onClose={clearMessages} />}
                <SignupForm
                  onSuccess={(msg) => { setSuccessMessage(msg); setErrorMessage(null) }}
                  onError={(msg) => { setErrorMessage(msg); setSuccessMessage(null) }}
                  inline
                />
                <p className="mt-3 font-mono text-xs text-gray-500 dark:text-gray-500">
                  {statsLoading ? (
                    <span className="inline-block h-3.5 w-64 max-w-full rounded bg-gray-200 dark:bg-white/10 animate-pulse align-middle" />
                  ) : (
                    <>
                      {totalSubscribers.toLocaleString()} subscribers · {totalSummaries.toLocaleString()} weekly issues · unsubscribe anytime
                    </>
                  )}
                </p>
              </div>
            </div>

            <div>
              {latestLoading ? (
                <div className="card animate-pulse h-64" />
              ) : latestSummary ? (
                <LatestDigestPreview summary={latestSummary} />
              ) : (
                <div className="card text-center text-gray-500 dark:text-gray-400 py-12">
                  First weekly digest coming soon.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Recent issues */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <RecentIssues excludeId={latestSummary?.id} />
      </section>
    </div>
  )
}
