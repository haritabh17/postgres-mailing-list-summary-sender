import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useSummary } from '../hooks/useSummary';
import { ArrowLeft, CalendarDays, Users, MessageSquare, Loader2, FileText, Link as LinkIcon, Twitter, Linkedin, Check, Share2 } from 'lucide-react';
import { markdownToHtml } from '../utils/markdown';

type SummaryLevel = 'brief' | 'detailed' | 'deep';

function DiscussionCard({
  discussion,
  index,
  defaultExpanded,
  summaryId,
}: {
  discussion: any;
  index: number;
  defaultExpanded: boolean;
  summaryId: string;
}) {
  const [level, setLevel] = useState<SummaryLevel>(defaultExpanded ? 'detailed' : 'brief');
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  
  const shareUrl = `https://www.postgreshackersdigest.dev/summary/${summaryId}?expand=${index + 1}#discussion-${index + 1}`;
  const briefSnippet = (discussion.summary_brief || '').slice(0, 150).trim() + ((discussion.summary_brief || '').length > 150 ? '...' : '');
  const shareText = `${discussion.subject}\n\n${briefSnippet}`;
  const tweetText = briefSnippet ? `${discussion.subject} — "${briefSnippet}"` : `${discussion.subject} — this week on pgsql-hackers`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(shareUrl)}`;
  const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
  
  const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share;
  
  const handleShare = async () => {
    try {
      await navigator.share({
        title: discussion.subject,
        text: shareText,
        url: shareUrl,
      });
    } catch (e) {
      // User cancelled or share failed — ignore
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    if (defaultExpanded && ref.current) {
      // Small delay to let the DOM settle
      setTimeout(() => {
        ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [defaultExpanded]);

  const getCurrentSummary = () => {
    if (level === 'deep' && discussion.summary_deep) return discussion.summary_deep;
    if (level === 'detailed' && discussion.summary_detailed) return discussion.summary_detailed;
    return discussion.summary_brief || '';
  };

  const canExpand = level !== 'deep' && (
    (level === 'brief' && discussion.summary_detailed) ||
    (level === 'detailed' && discussion.summary_deep)
  );
  const canCollapse = level !== 'brief';

  const getCommitfestTagStyle = (color: string | null) => {
    if (!color) return 'background-color: #e0f2fe; color: #0369a1; border-color: #bae6fd;';
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    const textColor = brightness > 128 ? '#000000' : '#ffffff';
    const borderColor = brightness > 128 ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.3)';
    return `background-color: ${color}; color: ${textColor}; border-color: ${borderColor};`;
  };

  return (
    <div ref={ref} id={`discussion-${index + 1}`} className="mb-8 pb-8 border-b border-gray-200 last:border-b-0">
      <h3 className="text-xl font-semibold text-postgres-700 mb-3">
        {index + 1}. {discussion.subject}
      </h3>

      <div className="text-sm text-gray-500 mb-3 flex flex-wrap gap-4">
        <span><strong>Posts</strong>: {discussion.post_count}</span>
        <span><strong>Participants</strong>: {discussion.participants}</span>
        <span><strong>Duration</strong>: {new Date(discussion.first_post_at).toLocaleDateString()} - {new Date(discussion.last_post_at).toLocaleDateString()}</span>
      </div>

      {discussion.thread_url && (
        <div className="text-sm mb-3">
          <strong>Reference Link</strong>:{' '}
          <a href={discussion.thread_url} target="_blank" rel="noopener noreferrer" className="text-postgres-600 hover:underline">
            View Thread
          </a>
        </div>
      )}

      {/* Commitfest tags */}
      {discussion.commitfest_tags && discussion.commitfest_tags.length > 0 && (
        <div className="tags-container" style={{ margin: '0.75rem 0', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
          <strong style={{ marginRight: '0.25rem', color: '#374151' }}>Commitfest Tags:</strong>
          {discussion.commitfest_tags.map((tag: any, i: number) => (
            <span key={i}>
              <span
                className="tag"
                data-tag-source="commitfest"
                style={{ ...parseStyle(getCommitfestTagStyle(tag.color)) }}
                title="Commitfest tag"
              >
                {escapeHtmlText(tag.name)}
              </span>
              {i < discussion.commitfest_tags.length - 1 && <span className="tag-separator">,</span>}
            </span>
          ))}
        </div>
      )}

      {/* AI tags */}
      {discussion.ai_tags && discussion.ai_tags.length > 0 && (
        <div className="tags-container" style={{ margin: '0.75rem 0', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
          <strong style={{ marginRight: '0.25rem', color: '#374151' }}>AI-Generated Discussion Tags:</strong>
          {discussion.ai_tags.map((tag: string, i: number) => (
            <span key={i}>
              <span className="tag" data-tag-source="ai" title="AI-generated tag">
                {tag}
              </span>
              {i < discussion.ai_tags.length - 1 && <span className="tag-separator">,</span>}
            </span>
          ))}
        </div>
      )}

      <div className="prose prose-lg max-w-none prose-p:text-gray-700 prose-p:leading-relaxed prose-p:mb-4 prose-p:text-justify mt-4">
        <div dangerouslySetInnerHTML={{ __html: markdownToHtml(getCurrentSummary()) }} />
      </div>

      <div className="mt-3 flex items-center gap-4">
        {canExpand && (
          <button
            onClick={() => setLevel(level === 'brief' ? 'detailed' : 'deep')}
            className="text-postgres-600 hover:text-postgres-800 font-medium text-sm transition-colors cursor-pointer"
          >
            Show more
          </button>
        )}
        {canCollapse && (
          <button
            onClick={() => setLevel('brief')}
            className="text-postgres-600 hover:text-postgres-800 font-medium text-sm transition-colors cursor-pointer"
          >
            Show less
          </button>
        )}
        <span className="text-gray-300">|</span>
        {canNativeShare ? (
          <button onClick={handleShare} className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 transition-colors">
            <Share2 className="h-3.5 w-3.5" />
            Share
          </button>
        ) : (
          <>
            <button onClick={handleCopy} className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 transition-colors">
              {copied ? <Check className="h-3.5 w-3.5" /> : <LinkIcon className="h-3.5 w-3.5" />}
              {copied ? 'Copied!' : 'Copy link'}
            </button>
            <a href={twitterUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 transition-colors">
              <Twitter className="h-3.5 w-3.5" />
              X
            </a>
            <a href={linkedinUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 transition-colors">
              <Linkedin className="h-3.5 w-3.5" />
              LinkedIn
            </a>
          </>
        )}
      </div>
    </div>
  );
}

// Helper to parse inline style string into React style object
function parseStyle(styleStr: string): React.CSSProperties {
  const style: any = {};
  styleStr.split(';').forEach(pair => {
    const [key, value] = pair.split(':').map(s => s.trim());
    if (key && value) {
      const camelKey = key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      style[camelKey] = value;
    }
  });
  return style;
}

function escapeHtmlText(text: string): string {
  return text.replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>');
}

function extractOverview(summaryContent: string): string {
  // Extract everything before "## Top Discussions"
  const topDiscIdx = summaryContent.indexOf('## Top Discussions');
  if (topDiscIdx === -1) return '';
  let overview = summaryContent.substring(0, topDiscIdx).trim();
  // Remove the H1 title line if present
  overview = overview.replace(/^#\s+.*$/m, '').trim();
  // Remove "## Overview" heading
  overview = overview.replace(/^##\s+Overview\s*/m, '').trim();
  return overview;
}


export function SummaryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { summary, isLoading, error } = useSummary(id || '');

  const expandParam = searchParams.get('expand');
  const expandIndex = expandParam ? parseInt(expandParam, 10) : null;

  const formatDateWithOrdinal = (dateString: string) => {
    const date = new Date(dateString);
    const day = date.getDate();
    const ordinal = (day: number) => {
      const s = ['th', 'st', 'nd', 'rd'];
      const v = day % 100;
      return day + (s[(v - 20) % 10] || s[v] || s[0]);
    };
    const monthYear = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    return `${ordinal(day)} ${monthYear}`;
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Check if top_discussions has multi-level summaries
  const hasMultiLevel = summary?.top_discussions?.some(
    (d: any) => d.summary_brief || d.summary_detailed || d.summary_deep
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-postgres-50 to-blue-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            to="/"
            className="inline-flex items-center text-postgres-600 hover:text-postgres-800 font-medium mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Link>

          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            PostgreSQL Weekly Summary
          </h1>
        </div>

        {isLoading && (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-postgres-600 mx-auto mb-4" />
            <p className="text-gray-700 text-lg">Loading summary...</p>
          </div>
        )}

        {error && (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="text-red-600 mb-4">
              <FileText className="h-12 w-12 mx-auto mb-2" />
              <p className="text-lg font-medium">Summary Not Found</p>
            </div>
            <p className="text-gray-600 mb-6">{error}</p>
            <Link to="/" className="btn-primary">
              Back to Home
            </Link>
          </div>
        )}

        {summary && (
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            {/* Summary Header */}
            <div className="bg-gradient-to-r from-postgres-600 to-postgres-700 text-white p-8">
              <h2 className="text-2xl font-bold mb-2">
                Week of {formatDateWithOrdinal(summary.week_end_date)}
              </h2>
              <div className="flex flex-wrap items-center gap-6 text-postgres-100">
                <div className="flex items-center">
                  <CalendarDays className="h-5 w-5 mr-2" />
                  <span>Generated on {formatDateTime(summary.created_at)}</span>
                </div>
                <div className="flex items-center">
                  <MessageSquare className="h-5 w-5 mr-2" />
                  <span>{summary.total_posts} posts</span>
                </div>
                <div className="flex items-center">
                  <Users className="h-5 w-5 mr-2" />
                  <span>{summary.total_participants} participants</span>
                </div>
              </div>
            </div>

            {/* Summary Content */}
            <div className="p-8">
              <style>{`
                .tags-container {
                  margin: 1rem 0;
                  display: flex;
                  flex-wrap: wrap;
                  align-items: center;
                  gap: 0.5rem;
                }
                .tags-container strong {
                  margin-right: 0.25rem;
                  color: #374151;
                }
                .tag {
                  display: inline-flex;
                  align-items: center;
                  padding: 0.375rem 0.75rem;
                  border-radius: 0.5rem;
                  font-size: 0.875rem;
                  font-weight: 500;
                  border: 1px solid;
                  transition: all 0.2s ease;
                  position: relative;
                }
                .tag[data-tag-source="commitfest"] {
                  border-style: solid;
                }
                .tag[data-tag-source="commitfest"]::after {
                  content: "●";
                  font-size: 0.5rem;
                  margin-left: 0.375rem;
                  opacity: 0.6;
                }
                .tag[data-tag-source="ai"] {
                  background-color: #f3f4f6;
                  color: #1f2937;
                  border-color: #d1d5db;
                  border-style: dashed;
                }
                .tag[data-tag-source="ai"]::after {
                  content: "◇";
                  font-size: 0.5rem;
                  margin-left: 0.375rem;
                  opacity: 0.5;
                  color: #6b7280;
                }
                .tag[data-tag-source="ai"]:hover {
                  background-color: #e5e7eb;
                  border-color: #9ca3af;
                }
              `}</style>

              {hasMultiLevel && summary.top_discussions ? (
                <>
                  {/* Overview from summary_content */}
                  {(() => {
                    const overview = extractOverview(summary.summary_content);
                    if (!overview) return null;
                    return (
                      <div className="prose prose-lg max-w-none prose-p:text-gray-700 prose-p:leading-relaxed prose-p:mb-4 prose-p:text-justify mb-8">
                        <h2 className="text-2xl font-semibold text-postgres-700 mb-4">Overview</h2>
                        <div dangerouslySetInnerHTML={{ __html: markdownToHtml(overview) }} />
                      </div>
                    );
                  })()}

                  <h2 className="text-2xl font-semibold text-postgres-700 mb-6">Top Discussions</h2>

                  {summary.top_discussions.map((discussion: any, index: number) => (
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
                /* Fallback: render summary_content markdown as before (backward compat) */
                <div
                  className="prose prose-lg max-w-none
                    prose-headings:text-postgres-700
                    prose-h1:text-3xl prose-h1:font-bold prose-h1:mb-6 prose-h1:mt-0
                    prose-h2:text-2xl prose-h2:font-semibold prose-h2:mb-4 prose-h2:mt-8
                    prose-h3:text-xl prose-h3:font-semibold prose-h3:mb-3 prose-h3:mt-6
                    prose-p:text-gray-700 prose-p:leading-relaxed prose-p:mb-4 prose-p:text-justify
                    prose-strong:text-gray-900 prose-strong:font-semibold
                    prose-code:text-postgres-700 prose-code:bg-postgres-50 prose-code:px-2 prose-code:py-1 prose-code:rounded prose-code:text-sm prose-code:font-mono
                    prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-pre:p-4 prose-pre:rounded-lg prose-pre:overflow-x-auto
                    prose-blockquote:border-l-4 prose-blockquote:border-postgres-300 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-gray-600
                    prose-ul:list-disc prose-ul:pl-6 prose-ul:mb-4
                    prose-ol:list-decimal prose-ol:pl-6 prose-ol:mb-4
                    prose-li:text-gray-700 prose-li:mb-2
                    prose-a:text-postgres-600 prose-a:no-underline hover:prose-a:underline
                    prose-table:border-collapse prose-table:w-full prose-table:mb-4
                    prose-th:bg-gray-100 prose-th:border prose-th:border-gray-300 prose-th:px-4 prose-th:py-2 prose-th:text-left prose-th:font-semibold
                    prose-td:border prose-td:border-gray-300 prose-td:px-4 prose-td:py-2
                    prose-hr:border-gray-300 prose-hr:my-8"
                  dangerouslySetInnerHTML={{
                    __html: markdownToHtml(summary.summary_content),
                  }}
                />
              )}
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-8 py-6 border-t border-gray-200">
              <div className="text-center text-gray-600 text-sm">
                <p className="mb-2">
                  This summary was generated using AI and may not capture all nuances of the original discussions.
                </p>
                <p>Source: PostgreSQL Hackers Mailing List</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
