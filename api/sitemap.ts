export default async function handler(req: any, res: any) {
  const baseUrl = process.env.SUPABASE_FUNCTIONS_BASE_URL ||
    (process.env.VITE_SUPABASE_URL ? `${process.env.VITE_SUPABASE_URL}/functions/v1` : null)
  const key = process.env.SUPABASE_EDGE_FUNCTION_KEY || process.env.VITE_SUPABASE_ANON_KEY

  if (!baseUrl || !key) {
    return res.status(500).send('Sitemap not configured')
  }

  try {
    const response = await fetch(`${baseUrl}/sitemap`, {
      headers: { Authorization: `Bearer ${key}` },
    })
    const body = await response.text()
    res.setHeader('Content-Type', 'application/xml; charset=utf-8')
    res.setHeader('Cache-Control', 'public, max-age=3600')
    res.status(response.status).send(body)
  } catch (error) {
    console.error('Sitemap proxy error:', error)
    res.status(500).send('Error fetching sitemap')
  }
}
