// Local preview of the RSS landing page with real data, without deploying.
// Usage: node scripts/preview-rss-landing.ts  (Node 23.6+ for type stripping)
import { readFileSync, writeFileSync } from 'node:fs'
import { renderFeedLandingHtml, type FeedLandingItem } from '../supabase/functions/rss/landing.ts'

const SITE_URL = 'https://www.postgreshackersdigest.dev'

const envFile = readFileSync(new URL('../frontend/.env.local', import.meta.url), 'utf8')
const readEnv = (key: string) => envFile.match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1]?.trim()

const supabaseUrl = readEnv('VITE_SUPABASE_URL')
const anonKey = readEnv('VITE_SUPABASE_ANON_KEY')
if (!supabaseUrl || !anonKey) throw new Error('Missing Supabase env in frontend/.env.local')

const query =
  'select=id,week_end_date,summary_content,top_discussions,total_posts,total_participants,created_at' +
  '&order=week_start_date.desc&limit=10'
const res = await fetch(`${supabaseUrl}/rest/v1/weekly_summaries?${query}`, {
  headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
})
if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)
const rows = await res.json()

function formatDateWithOrdinal(dateString: string): string {
  const date = new Date(dateString)
  const day = date.getDate()
  const ordinal = (d: number) => {
    const s = ['th', 'st', 'nd', 'rd']
    const v = d % 100
    return d + (s[(v - 20) % 10] || s[v] || s[0])
  }
  return `${ordinal(day)} ${date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
}

const items: FeedLandingItem[] = rows.map((s: any) => ({
  title: `Week of ${formatDateWithOrdinal(s.week_end_date)}`,
  link: `${SITE_URL}/summary/${s.id}`,
  isoDate: s.created_at,
  description:
    s.top_discussions?.[0]?.summary_brief ||
    s.summary_content?.substring(0, 300) ||
    `${s.total_posts} posts from ${s.total_participants} participants`,
  posts: s.total_posts,
  participants: s.total_participants,
}))

const outPath = '/tmp/rss-landing-preview.html'
writeFileSync(outPath, renderFeedLandingHtml(items, { feedUrl: `${SITE_URL}/rss.xml`, siteUrl: SITE_URL }))
console.log(`Preview written to ${outPath} (${items.length} issues)`)
