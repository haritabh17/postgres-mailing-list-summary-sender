import { Link } from 'react-router-dom'
import { MessageSquare, Users, ArrowRight, Loader2 } from 'lucide-react'
import { useSummaries } from '../hooks/useSummaries'
import { formatDateWithOrdinal } from '../utils/dates'
import { TagChip } from './TagChip'
import { dedupeAiTags } from '../utils/tags'

// Fetch one extra so six cards remain after excluding the latest issue
// (which is featured in the hero).
const FETCH_SIZE = 7

export function RecentIssues({ excludeId }: { excludeId?: string }) {
  const { summaries, isLoading, isLoadingMore, hasMore, loadMore } = useSummaries(null, null, FETCH_SIZE)

  const filtered = excludeId ? summaries.filter((s) => s.id !== excludeId) : summaries

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="card animate-pulse h-44" />
        ))}
      </div>
    )
  }

  if (filtered.length === 0) return null

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <p className="eyebrow mb-1">From the archive</p>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Recent issues</h2>
        </div>
        <Link
          to="/archive"
          className="text-sm font-medium text-pg-700 hover:text-pg-600 dark:text-accent-400 dark:hover:text-accent-300 flex items-center gap-1"
        >
          View all <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((summary) => {
          const topDiscussion = summary.top_discussions?.[0]
          const aiTags = dedupeAiTags(topDiscussion?.commitfest_tags, topDiscussion?.ai_tags)
          return (
            <Link key={summary.id} to={`/summary/${summary.id}`} className="card-hover group flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-gray-900 dark:text-white group-hover:text-pg-700 dark:group-hover:text-accent-400 transition-colors">
                  Week of {formatDateWithOrdinal(summary.week_end_date)}
                </span>
                <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-pg-600 dark:group-hover:text-accent-400 transition-colors" />
              </div>
              <div className="flex gap-4 font-mono text-xs text-gray-500 dark:text-gray-400 mb-3">
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  {summary.total_posts} posts
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {summary.total_participants} people
                </span>
              </div>
              {topDiscussion && (
                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3 flex-1">
                  {topDiscussion.subject}
                </p>
              )}
              <div className="flex flex-wrap gap-1.5 mt-auto">
                {topDiscussion?.commitfest_tags?.slice(0, 1).map((tag, i) => (
                  <TagChip key={`cf-${i}`} tag={tag} source="commitfest" clickable={false} />
                ))}
                {aiTags.slice(0, 2).map((tag, i) => (
                  <TagChip key={`ai-${i}`} tag={tag} source="ai" clickable={false} />
                ))}
              </div>
            </Link>
          )
        })}
      </div>
      {hasMore && (
        <div className="text-center mt-6">
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
    </div>
  )
}
