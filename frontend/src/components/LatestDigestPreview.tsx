import { Link } from 'react-router-dom'
import { Calendar, Users, MessageSquare, ArrowRight, Mail } from 'lucide-react'
import type { WeeklySummary } from '../lib/types'
import { formatDateWithOrdinal } from '../utils/dates'
import { TagChip } from './TagChip'
import { dedupeAiTags } from '../utils/tags'

interface LatestDigestPreviewProps {
  summary: WeeklySummary
}

export function LatestDigestPreview({ summary }: LatestDigestPreviewProps) {
  const topDiscussions = summary.top_discussions?.slice(0, 3) || []

  return (
    <div className="card p-0 overflow-hidden border-pg-200 dark:border-pg-700/70 shadow-[0_8px_30px_-12px_rgba(16,42,67,0.25)] dark:shadow-[0_8px_40px_-12px_rgba(0,0,0,0.6)]">
      {/* Email-style header */}
      <div className="px-6 py-4 border-b border-surface-border dark:border-surface-dark-border bg-pg-50/60 dark:bg-pg-900/30">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-pg-700 dark:bg-pg-700/80 flex items-center justify-center shrink-0">
            <Mail className="h-[18px] w-[18px] text-white" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-white truncate">
              This week — {formatDateWithOrdinal(summary.week_end_date)}
            </h3>
            <div className="flex flex-wrap gap-3 font-mono text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                {summary.total_posts} posts
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {summary.total_participants} participants
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(summary.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </div>
          </div>
        </div>
      </div>

      <ol className="px-6 py-5 space-y-5">
        {topDiscussions.map((d, i) => {
          const aiTags = dedupeAiTags(d.commitfest_tags, d.ai_tags)
          return (
            <li key={i} className="text-sm flex gap-3">
              <span className="font-mono text-xs text-pg-600 dark:text-accent-400 pt-0.5 shrink-0">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0">
                <Link
                  to={`/summary/${summary.id}?expand=${i + 1}#discussion-${i + 1}`}
                  className="font-medium text-gray-900 dark:text-gray-100 hover:text-pg-700 dark:hover:text-accent-400 transition-colors"
                >
                  {d.subject}
                </Link>
                {d.summary_brief && (
                  <p className="text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{d.summary_brief}</p>
                )}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {d.commitfest_tags?.slice(0, 2).map((tag, j) => (
                    <TagChip key={`cf-${j}`} tag={tag} source="commitfest" clickable={false} />
                  ))}
                  {aiTags.slice(0, 2).map((tag, j) => (
                    <TagChip key={`ai-${j}`} tag={tag} source="ai" clickable={false} />
                  ))}
                </div>
              </div>
            </li>
          )
        })}
      </ol>

      <div className="px-6 py-3.5 border-t border-surface-border dark:border-surface-dark-border">
        <Link
          to={`/summary/${summary.id}`}
          className="text-sm font-medium text-pg-700 hover:text-pg-600 dark:text-accent-400 dark:hover:text-accent-300 flex items-center gap-1.5"
        >
          Read the full issue <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  )
}
