export default async function handler(req: any, res: any) {
  const baseUrl = process.env.SUPABASE_FUNCTIONS_BASE_URL ||
    (process.env.VITE_SUPABASE_URL ? `${process.env.VITE_SUPABASE_URL}/functions/v1` : null)
  const key = process.env.SUPABASE_EDGE_FUNCTION_KEY || process.env.VITE_SUPABASE_ANON_KEY

  if (!baseUrl || !key) {
    return res.status(500).send('RSS feed not configured')
  }

  try {
    // Forward content-negotiation headers so the edge function can serve a
    // styled HTML landing page to browsers and raw XML to feed readers.
    const headers: Record<string, string> = { Authorization: `Bearer ${key}` }
    if (req.headers['accept']) headers['Accept'] = String(req.headers['accept'])
    if (req.headers['sec-fetch-dest']) headers['Sec-Fetch-Dest'] = String(req.headers['sec-fetch-dest'])

    const response = await fetch(`${baseUrl}/rss`, { headers })
    const body = await response.text()

    // Don't trust the upstream content-type: Supabase's gateway rewrites HTML
    // responses to text/plain. Derive it from the request we negotiated with.
    const isBrowser =
      req.headers['sec-fetch-dest'] === 'document' ||
      String(req.headers['accept'] || '').includes('text/html')
    res.setHeader(
      'Content-Type',
      response.ok && isBrowser ? 'text/html; charset=utf-8' : 'application/rss+xml; charset=utf-8'
    )
    res.setHeader('Cache-Control', 'public, max-age=3600')
    res.setHeader('Vary', 'Accept, Sec-Fetch-Dest')
    res.status(response.status).send(body)
  } catch (error) {
    console.error('RSS proxy error:', error)
    res.status(500).send('Error fetching RSS feed')
  }
}
