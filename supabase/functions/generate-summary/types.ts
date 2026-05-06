export interface CommitfestTag {
  name: string
  color: string | null
}

export interface TopDiscussion {
  thread_id: string
  subject: string
  post_count: number
  participants: number
  first_post_at: string
  last_post_at: string
  full_content?: any[]
  commitfest_tags?: CommitfestTag[]
}

export interface WeeklySummary {
  week_start_date: string
  week_end_date: string
  summary_content: string
  top_discussions: TopDiscussion[]
  total_posts: number
  total_participants: number
}
