const SITE_URL = 'https://www.postgreshackersdigest.dev'

export default async function handler(req: any, res: any) {
  const { id } = req.query

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Missing summary id' })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Missing Supabase config' })
  }

  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/weekly_summaries?id=eq.${id}&select=id,week_end_date,total_posts,total_participants,top_discussions,created_at`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      }
    )

    const data = await response.json()
    const summary = data?.[0]

    if (!summary) {
      return res.status(404).json({ error: 'Summary not found' })
    }

    const date = new Date(summary.week_end_date)
    const day = date.getDate()
    const ordinal = (d: number) => {
      const s = ['th', 'st', 'nd', 'rd']
      const v = d % 100
      return d + (s[(v - 20) % 10] || s[v] || s[0])
    }
    const monthYear = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    const weekLabel = `Week of ${ordinal(day)} ${monthYear}`

    const description = summary.top_discussions?.[0]?.summary_brief?.slice(0, 160) ||
      `${summary.total_posts} posts from ${summary.total_participants} participants on the PostgreSQL hackers mailing list.`

    const ogImage = `${SITE_URL}/api/og?title=${encodeURIComponent(weekLabel)}&date=${encodeURIComponent(monthYear)}&posts=${summary.total_posts}&participants=${summary.total_participants}`

    res.setHeader('Cache-Control', 'public, max-age=3600')
    return res.status(200).json({
      title: `${weekLabel} — PostgreSQL Hackers Digest`,
      description,
      url: `${SITE_URL}/summary/${summary.id}`,
      ogImage,
      publishedTime: summary.created_at,
    })
  } catch (error) {
    console.error('Meta API error:', error)
    return res.status(500).json({ error: 'Failed to fetch summary metadata' })
  }
}
