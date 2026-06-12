const BOT_AGENTS = /bot|crawl|spider|slurp|facebook|twitter|linkedin|whatsapp|telegram|discord|preview/i

export const config = {
  matcher: '/summary/:id',
}

export default async function middleware(request: Request) {
  const userAgent = request.headers.get('user-agent') || ''
  const url = new URL(request.url)
  const id = url.pathname.split('/summary/')[1]

  if (!id || !BOT_AGENTS.test(userAgent)) {
    return fetch(request)
  }

  try {
    const metaUrl = new URL(`/api/meta?id=${encodeURIComponent(id)}`, url.origin)
    const metaRes = await fetch(metaUrl.toString())
    if (!metaRes.ok) return fetch(request)

    const meta = await metaRes.json()
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(meta.title)}</title>
  <meta name="description" content="${escapeHtml(meta.description)}" />
  <meta property="og:title" content="${escapeHtml(meta.title)}" />
  <meta property="og:description" content="${escapeHtml(meta.description)}" />
  <meta property="og:url" content="${escapeHtml(meta.url)}" />
  <meta property="og:image" content="${escapeHtml(meta.ogImage)}" />
  <meta property="og:type" content="article" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(meta.title)}" />
  <meta name="twitter:description" content="${escapeHtml(meta.description)}" />
  <meta name="twitter:image" content="${escapeHtml(meta.ogImage)}" />
  <link rel="canonical" href="${escapeHtml(meta.url)}" />
  <script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: meta.title,
    description: meta.description,
    url: meta.url,
    datePublished: meta.publishedTime,
    publisher: { '@type': 'Organization', name: 'PostgreSQL Hackers Digest' },
  })}</script>
  <meta http-equiv="refresh" content="0;url=${escapeHtml(meta.url)}" />
</head>
<body>
  <p>Redirecting to <a href="${escapeHtml(meta.url)}">${escapeHtml(meta.title)}</a></p>
</body>
</html>`

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
    })
  } catch {
    return fetch(request)
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
