import { useState, useEffect, useRef } from 'react'
import { Link as LinkIcon, Twitter, Linkedin, Check, Share2 } from 'lucide-react'
import type { TopDiscussion } from '../lib/types'
import { TagChip } from './TagChip'
import { StatusBadge } from './StatusBadge'
import { SummaryLevelControl, type SummaryLevel } from './SummaryLevelControl'
import { formatDateRange } from '../utils/dates'
import { sanitizeHtml } from '../utils/markdown'
import { dedupeAiTags } from '../utils/tags'

const SITE_URL = 'https://www.postgreshackersdigest.dev'

interface DiscussionCardProps {
  discussion: TopDiscussion
  index: number
  defaultExpanded: boolean
  summaryId: string
}

export function DiscussionCard({ discussion, index, defaultExpanded, summaryId }: DiscussionCardProps) {
  const [level, setLevel] = useState<SummaryLevel>(defaultExpanded ? 'detailed' : 'brief')
  const [copied, setCopied] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const shareUrl = `${SITE_URL}/summary/${summaryId}?expand=${index + 1}#discussion-${index + 1}`
  const briefSnippet = (discussion.summary_brief || '').slice(0, 150).trim()
  const shareText = briefSnippet
    ? `${discussion.subject} — "${briefSnippet}${discussion.summary_brief && discussion.summary_brief.length > 150 ? '...' : ''}"`
    : discussion.subject
  const tweetText = briefSnippet
    ? `${discussion.subject} — "${briefSnippet}"`
    : `${discussion.subject} — this week on pgsql-hackers`
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(shareUrl)}`
  const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`
  const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share

  useEffect(() => {
    if (defaultExpanded && ref.current) {
      setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    }
  }, [defaultExpanded])

  const getCurrentSummary = () => {
    if (level === 'deep' && discussion.summary_deep) return discussion.summary_deep
    if (level === 'detailed' && discussion.summary_detailed) return discussion.summary_detailed
    return discussion.summary_brief || ''
  }

  const handleShare = async () => {
    try {
      await navigator.share({ title: discussion.subject, text: shareText, url: shareUrl })
    } catch {
      // user cancelled
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const aiTags = dedupeAiTags(discussion.commitfest_tags, discussion.ai_tags)

  return (
    <article ref={ref} id={`discussion-${index + 1}`} className="scroll-mt-24 pb-8 mb-8 border-b border-surface-border dark:border-surface-dark-border last:border-b-0">
      <div className="flex flex-wrap items-start gap-2 mb-2">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white flex-1">
          {index + 1}. {discussion.subject}
        </h3>
        <StatusBadge status={discussion.status} />
      </div>

      {discussion.why_it_matters && (
        <p className="text-sm text-pg-700 dark:text-accent-400 font-medium mb-3 italic">
          {discussion.why_it_matters}
        </p>
      )}

      <div className="text-sm text-gray-500 dark:text-gray-400 mb-3 flex flex-wrap gap-4">
        <span><strong className="text-gray-700 dark:text-gray-300">Posts</strong>: {discussion.post_count}</span>
        <span><strong className="text-gray-700 dark:text-gray-300">Participants</strong>: {discussion.participants}</span>
        <span><strong className="text-gray-700 dark:text-gray-300">Duration</strong>: {formatDateRange(discussion.first_post_at, discussion.last_post_at)}</span>
        {discussion.key_people && discussion.key_people.length > 0 && (
          <span><strong className="text-gray-700 dark:text-gray-300">Key people</strong>: {discussion.key_people.join(', ')}</span>
        )}
      </div>

      {discussion.thread_url && (
        <div className="text-sm mb-3">
          <a href={discussion.thread_url} target="_blank" rel="noopener noreferrer" className="text-pg-700 hover:underline dark:text-accent-400">
            View thread ↗
          </a>
        </div>
      )}

      {(discussion.commitfest_tags?.length || aiTags.length) ? (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {discussion.commitfest_tags?.map((tag, i) => (
            <TagChip key={`cf-${i}`} tag={tag} source="commitfest" />
          ))}
          {aiTags.map((tag, i) => (
            <TagChip key={`ai-${i}`} tag={tag} source="ai" />
          ))}
        </div>
      ) : null}

      <div className="mb-4">
        <SummaryLevelControl
          level={level}
          onChange={setLevel}
          hasDetailed={!!discussion.summary_detailed}
          hasDeep={!!discussion.summary_deep}
        />
      </div>

      <div className="prose prose-lg max-w-none dark:prose-invert prose-p:text-gray-700 dark:prose-p:text-gray-300 prose-p:leading-relaxed">
        <p
          dangerouslySetInnerHTML={{
            __html: sanitizeHtml(getCurrentSummary().replace(/`([^`]+)`/g, '<code>$1</code>')),
          }}
        />
      </div>

      <div className="mt-4 flex items-center gap-4">
        {canNativeShare ? (
          <button onClick={handleShare} className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            <Share2 className="h-3.5 w-3.5" />
            Share
          </button>
        ) : (
          <>
            <button onClick={handleCopy} className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              {copied ? <Check className="h-3.5 w-3.5" /> : <LinkIcon className="h-3.5 w-3.5" />}
              {copied ? 'Copied!' : 'Copy link'}
            </button>
            <a href={twitterUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              <Twitter className="h-3.5 w-3.5" />
              X
            </a>
            <a href={linkedinUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              <Linkedin className="h-3.5 w-3.5" />
              LinkedIn
            </a>
          </>
        )}
      </div>
    </article>
  )
}
