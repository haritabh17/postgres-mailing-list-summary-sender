export default async function handler(req: any, res: any) {
  const { title, date, posts, participants } = req.query

  const displayTitle = (title as string) || 'PostgreSQL Hackers Digest'
  const displayDate = (date as string) || ''
  const displayPosts = (posts as string) || ''
  const displayParticipants = (participants as string) || ''

  const svg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0d1117"/>
      <stop offset="100%" style="stop-color:#111827"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="60" y="60" width="1080" height="510" rx="16" fill="#1a2332" stroke="#336791" stroke-width="2"/>
  <g transform="translate(100, 118) scale(1.5)">
    <rect width="32" height="32" rx="7" fill="#336791"/>
    <circle cx="7.6" cy="13.4" r="4.6" fill="white"/>
    <circle cx="24.4" cy="13.4" r="4.6" fill="white"/>
    <ellipse cx="16" cy="13.4" rx="8.4" ry="8" fill="white"/>
    <path d="M10.6 19.6 L9.5 22.3" stroke="white" stroke-width="2.1" stroke-linecap="round"/>
    <path d="M21.4 19.6 L22.5 22.3" stroke="white" stroke-width="2.1" stroke-linecap="round"/>
    <path d="M16 14.8 C16 19.4 16.1 21.6 15.5 23.4 C15 24.9 14 25.7 12.7 25.5" stroke="white" stroke-width="3" stroke-linecap="round"/>
    <circle cx="12.8" cy="11.9" r="1.3" fill="#336791"/>
    <circle cx="19.2" cy="11.9" r="1.3" fill="#336791"/>
  </g>
  <text x="162" y="152" font-family="system-ui, sans-serif" font-size="28" fill="#7dd3fc" font-weight="500">PostgreSQL Hackers Digest</text>
  <text x="100" y="240" font-family="system-ui, sans-serif" font-size="48" fill="#ffffff" font-weight="700">${escapeXml(displayTitle)}</text>
  ${displayDate ? `<text x="100" y="310" font-family="system-ui, sans-serif" font-size="24" fill="#9ca3af">${escapeXml(displayDate)}</text>` : ''}
  ${displayPosts ? `<text x="100" y="380" font-family="system-ui, sans-serif" font-size="22" fill="#6b7280">${escapeXml(displayPosts)} posts · ${escapeXml(displayParticipants)} participants</text>` : ''}
  <text x="100" y="500" font-family="system-ui, sans-serif" font-size="18" fill="#4b5563">postgreshackersdigest.dev</text>
</svg>`

  res.setHeader('Content-Type', 'image/svg+xml')
  res.setHeader('Cache-Control', 'public, max-age=86400')
  res.status(200).send(svg)
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
