import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { renderFeedLandingHtml, type FeedLandingItem } from './landing.ts'

const SITE_URL = 'https://www.postgreshackersdigest.dev'
const FEED_URL = `${SITE_URL}/rss.xml`

// Browsers navigating to the feed URL get a styled HTML landing page;
// feed readers (which never send these headers) get the raw XML.
function isBrowserNavigation(req: Request): boolean {
  if (req.headers.get('sec-fetch-dest') === 'document') return true
  return (req.headers.get('accept') || '').includes('text/html')
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function formatRfc822(dateString: string): string {
  return new Date(dateString).toUTCString()
}

function formatDateWithOrdinal(dateString: string): string {
  const date = new Date(dateString)
  const day = date.getDate()
  const ordinal = (d: number) => {
    const s = ['th', 'st', 'nd', 'rd']
    const v = d % 100
    return d + (s[(v - 20) % 10] || s[v] || s[0])
  }
  const monthYear = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  return `${ordinal(day)} ${monthYear}`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: summaries, error } = await supabase
      .from('weekly_summaries')
      .select('id, week_end_date, summary_content, top_discussions, total_posts, total_participants, created_at')
      .order('week_start_date', { ascending: false })
      .limit(50)

    if (error) throw error

    const lastBuild = summaries?.[0]?.created_at || new Date().toISOString()

    const feedItems: FeedLandingItem[] = (summaries || []).map((s) => ({
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

    if (isBrowserNavigation(req)) {
      const html = renderFeedLandingHtml(feedItems.slice(0, 10), {
        feedUrl: FEED_URL,
        siteUrl: SITE_URL,
      })
      return new Response(html, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=3600',
          'Vary': 'Accept, Sec-Fetch-Dest',
        },
      })
    }

    const items = feedItems.map((item) => `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${item.link}</link>
      <guid isPermaLink="true">${item.link}</guid>
      <pubDate>${formatRfc822(item.isoDate)}</pubDate>
      <description>${escapeXml(item.description)}</description>
    </item>`).join('\n')

    const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>PostgreSQL Hackers Digest</title>
    <link>${SITE_URL}</link>
    <description>Weekly AI-powered summaries of PostgreSQL hackers mailing list discussions.</description>
    <language>en-us</language>
    <lastBuildDate>${formatRfc822(lastBuild)}</lastBuildDate>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`

    return new Response(feed, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
        'Vary': 'Accept, Sec-Fetch-Dest',
      },
    })
  } catch (error) {
    console.error('RSS feed error:', error)
    return new Response('Error generating RSS feed', { status: 500 })
  }
})
