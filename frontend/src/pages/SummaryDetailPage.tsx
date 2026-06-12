import { useEffect } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { useSummary } from '../hooks/useSummary'
import { ArrowLeft, ArrowRight, CalendarDays, Users, MessageSquare, Loader2, FileText } from 'lucide-react'
import { DiscussionCard } from '../components/DiscussionCard'
import { formatDateWithOrdinal, formatDateTime } from '../utils/dates'
import { markdownToHtml } from '../utils/markdown'

function extractOverview(summaryContent: string): string {
  const topDiscIdx = summaryContent.indexOf('## Top Discussions')
  if (topDiscIdx === -1) return ''
  let overview = summaryContent.substring(0, topDiscIdx).trim()
  overview = overview.replace(/^#\s+.*$/m, '').trim()
  overview = overview.replace(/^##\s+Overview\s*/m, '').trim()
  return overview
}

export function SummaryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const { summary, adjacent, isLoading, error } = useSummary(id || '')

  const expandParam = searchParams.get('expand')
  const expandIndex = expandParam ? parseInt(expandParam, 10) : null

  const hasMultiLevel = summary?.top_discussions?.some(
    (d) => d.summary_brief || d.summary_detailed || d.summary_deep
  )

  useEffect(() => {
    if (summary) {
      const title = `Week of ${formatDateWithOrdinal(summary.week_end_date)} — PostgreSQL Hackers Digest`
      document.title = title

      const desc = summary.top_discussions?.[0]?.summary_brief?.slice(0, 160) ||
        `Weekly summary of ${summary.total_posts} posts from ${summary.total_participants} participants.`
      let metaDesc = document.querySelector('meta[name="description"]')
      if (!metaDesc) {
        metaDesc = document.createElement('meta')
        metaDesc.setAttribute('name', 'description')
        document.head.appendChild(metaDesc)
      }
      metaDesc.setAttribute('content', desc)

      const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: title,
        datePublished: summary.created_at,
        description: desc,
        url: `https://www.postgreshackersdigest.dev/summary/${summary.id}`,
        publisher: { '@type': 'Organization', name: 'PostgreSQL Hackers Digest' },
      }
      let script = document.getElementById('json-ld-article') as HTMLScriptElement | null
      if (!script) {
        script = document.createElement('script')
        script.id = 'json-ld-article'
        script.type = 'application/ld+json'
        document.head.appendChild(script)
      }
      script.textContent = JSON.stringify(jsonLd)
    }
    return () => {
      document.title = 'PostgreSQL Hackers Digest'
      document.getElementById('json-ld-article')?.remove()
    }
  }, [summary])

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-24 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-pg-700 mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-400">Loading summary...</p>
      </div>
    )
  }

  if (error || !summary) {
    return (
      <div className="max-w-lg mx-auto px-4 py-24 text-center">
        <FileText className="h-12 w-12 mx-auto text-red-500 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Summary not found</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
        <Link to="/" className="btn-primary">Back to home</Link>
      </div>
    )
  }

  const overview = hasMultiLevel ? extractOverview(summary.summary_content) : ''

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb + nav */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <nav className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            <Link to="/archive" className="hover:text-pg-700 dark:hover:text-accent-400">Archive</Link>
            <span className="mx-2">/</span>
            <span>Week of {formatDateWithOrdinal(summary.week_end_date)}</span>
          </nav>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Week of {formatDateWithOrdinal(summary.week_end_date)}
          </h1>
          <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1"><MessageSquare className="h-4 w-4" />{summary.total_posts} posts</span>
            <span className="flex items-center gap-1"><Users className="h-4 w-4" />{summary.total_participants} participants</span>
            <span className="flex items-center gap-1"><CalendarDays className="h-4 w-4" />Generated {formatDateTime(summary.created_at)}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {adjacent.prev && (
            <Link to={`/summary/${adjacent.prev}`} className="btn-ghost text-sm flex items-center gap-1">
              <ArrowLeft className="h-4 w-4" /> Previous week
            </Link>
          )}
          {adjacent.next && (
            <Link to={`/summary/${adjacent.next}`} className="btn-ghost text-sm flex items-center gap-1">
              Next week <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-[200px_1fr] gap-8">
        {/* TOC sidebar */}
        {hasMultiLevel && summary.top_discussions && (
          <aside className="hidden lg:block">
            <nav className="sticky top-24 text-sm">
              <p className="font-semibold text-gray-900 dark:text-white mb-3">On this page</p>
              <ul className="space-y-2 border-l border-surface-border dark:border-surface-dark-border">
                {overview && (
                  <li>
                    <a href="#overview" className="block pl-4 py-1 text-gray-600 hover:text-pg-700 dark:text-gray-400 dark:hover:text-accent-400 border-l-2 border-transparent hover:border-pg-500 -ml-px">
                      Overview
                    </a>
                  </li>
                )}
                {summary.top_discussions.map((d, i) => (
                  <li key={i}>
                    <a
                      href={`#discussion-${i + 1}`}
                      className={`block pl-4 py-1 border-l-2 -ml-px transition-colors ${
                        expandIndex === i + 1
                          ? 'text-pg-700 dark:text-accent-400 border-pg-700 dark:border-pg-400 font-medium'
                          : 'text-gray-600 hover:text-pg-700 dark:text-gray-400 dark:hover:text-accent-400 border-transparent hover:border-pg-500'
                      }`}
                    >
                      {i + 1}. {d.subject.length > 40 ? d.subject.slice(0, 40) + '…' : d.subject}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>
        )}

        {/* Main content */}
        <div className="card min-w-0">
          {hasMultiLevel && summary.top_discussions ? (
            <>
              {overview && (
                <section id="overview" className="scroll-mt-24 mb-8">
                  <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">Overview</h2>
                  <div
                    className="prose prose-lg dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: markdownToHtml(overview) }}
                  />
                </section>
              )}

              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">This week's most active discussions</h2>
              {summary.top_discussions.map((discussion, index) => (
                <DiscussionCard
                  key={index}
                  discussion={discussion}
                  index={index}
                  defaultExpanded={expandIndex === index + 1}
                  summaryId={id!}
                />
              ))}
            </>
          ) : (
            <div
              className="prose prose-lg dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: markdownToHtml(summary.summary_content) }}
            />
          )}

          <div className="mt-8 pt-6 border-t border-surface-border dark:border-surface-dark-border text-center text-sm text-gray-500 dark:text-gray-400">
            <p>This summary was generated using AI and may not capture all nuances of the original discussions.</p>
            <p className="mt-1">Source: PostgreSQL Hackers Mailing List</p>
          </div>
        </div>
      </div>
    </div>
  )
}
