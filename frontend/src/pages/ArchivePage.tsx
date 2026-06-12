import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Calendar, Users, FileText, Loader2, Search, X } from 'lucide-react'
import { useSummaries } from '../hooks/useSummaries'
import { formatDate, formatDateWithOrdinal } from '../utils/dates'
import { TagChip } from '../components/TagChip'

export function ArchivePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tagFilter = searchParams.get('tag')
  const [searchInput, setSearchInput] = useState(searchParams.get('q') || '')
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '')

  const { summaries, isLoading, isLoadingMore, error, hasMore, loadMore } = useSummaries(tagFilter, searchQuery)

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearchQuery(searchInput)
    const params = new URLSearchParams(searchParams)
    if (searchInput) params.set('q', searchInput)
    else params.delete('q')
    setSearchParams(params)
  }

  const clearTag = () => {
    const params = new URLSearchParams(searchParams)
    params.delete('tag')
    setSearchParams(params)
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto px-4 py-24 text-center">
        <FileText className="h-12 w-12 mx-auto text-red-500 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Error loading archive</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
        <Link to="/" className="btn-primary">Back to home</Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Archive</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Browse all weekly summaries of the PostgreSQL hackers mailing list.
        </p>
      </div>

      {/* Search + tag filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search summaries..."
              className="input-field pl-10"
            />
          </div>
          <button type="submit" className="btn-primary">Search</button>
        </form>
        {tagFilter && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Filtered by:</span>
            <TagChip tag={tagFilter} source="ai" clickable={false} />
            <button onClick={clearTag} className="p-1 text-gray-400 hover:text-gray-600" aria-label="Clear filter">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card animate-pulse h-28" />
          ))}
        </div>
      ) : summaries.length === 0 ? (
        <div className="card text-center py-12">
          <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No summaries found</h3>
          <p className="text-gray-600 dark:text-gray-400">
            {searchQuery || tagFilter ? 'Try a different search or clear filters.' : 'Check back soon!'}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {summaries.map((summary) => (
              <Link key={summary.id} to={`/summary/${summary.id}`} className="card-hover block">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      Week of {formatDateWithOrdinal(summary.week_end_date)}
                    </h3>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" />{summary.total_posts} posts</span>
                      <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{summary.total_participants} participants</span>
                      <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />Generated {formatDate(summary.created_at)}</span>
                    </div>
                    {summary.top_discussions?.[0] && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 line-clamp-1">
                        Top: {summary.top_discussions[0].subject}
                      </p>
                    )}
                  </div>
                  <span className="text-pg-700 dark:text-accent-400 text-sm font-medium">Read →</span>
                </div>
              </Link>
            ))}
          </div>
          {hasMore && (
            <div className="text-center mt-8">
              <button onClick={loadMore} disabled={isLoadingMore} className="btn-ghost">
                {isLoadingMore ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading...
                  </span>
                ) : (
                  'Show more'
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
