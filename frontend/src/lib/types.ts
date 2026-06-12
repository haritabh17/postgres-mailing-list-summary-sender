export interface ApiResponse<T = unknown> {
  data?: T
  error?: string
  message?: string
}

export interface SubscriptionResult {
  success: boolean
  message: string
  isNewSubscription?: boolean
}

export interface UnsubscribeResult {
  success: boolean
  message: string
}

export interface CommitfestTag {
  name: string
  color: string | null
}

export type DiscussionStatus = 'proposal' | 'patch_review' | 'committed' | 'debate' | 'unknown'

export interface TopDiscussion {
  thread_id?: string
  subject: string
  post_count: number
  participants: number
  first_post_at: string
  last_post_at: string
  thread_url?: string
  redirect_slug?: string
  commitfest_tags?: CommitfestTag[]
  ai_tags?: string[]
  summary_brief?: string
  summary_detailed?: string
  summary_deep?: string
  why_it_matters?: string
  status?: DiscussionStatus
  key_people?: string[]
}

export interface WeeklySummary {
  id: string
  week_start_date: string
  week_end_date: string
  summary_content: string
  top_discussions?: TopDiscussion[]
  total_posts: number
  total_participants: number
  created_at: string
  updated_at?: string
}

export interface WeeklySummaryListItem {
  id: string
  week_start_date: string
  week_end_date: string
  total_posts: number
  total_participants: number
  created_at: string
  top_discussions?: TopDiscussion[]
}

export interface PublicStats {
  totalSubscribers: number
  totalSummaries: number
}
