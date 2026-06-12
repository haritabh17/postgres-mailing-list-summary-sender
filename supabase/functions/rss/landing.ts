// Styled HTML landing page served to browsers that open the RSS feed URL.
// Feed readers still receive raw XML — see the content negotiation in index.ts.
//
// Constraints: no JavaScript (site CSP is script-src 'self'), self-contained
// CSS, light/dark via prefers-color-scheme to match the site design system.

export interface FeedLandingItem {
  title: string
  link: string
  isoDate: string
  description: string
  posts?: number
  participants?: number
}

export interface FeedLandingOptions {
  feedUrl: string
  siteUrl: string
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatDisplayDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const LOGO_SVG = `<svg viewBox="0 0 32 32" width="34" height="34" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="32" height="32" rx="7" fill="#336791"/><circle cx="7.6" cy="13.4" r="4.6" fill="white"/><circle cx="24.4" cy="13.4" r="4.6" fill="white"/><ellipse cx="16" cy="13.4" rx="8.4" ry="8" fill="white"/><path d="M10.6 19.6 L9.5 22.3" stroke="white" stroke-width="2.1" stroke-linecap="round"/><path d="M21.4 19.6 L22.5 22.3" stroke="white" stroke-width="2.1" stroke-linecap="round"/><path d="M16 14.8 C16 19.4 16.1 21.6 15.5 23.4 C15 24.9 14 25.7 12.7 25.5" stroke="white" stroke-width="3" stroke-linecap="round"/><circle cx="12.8" cy="11.9" r="1.3" fill="#336791"/><circle cx="19.2" cy="11.9" r="1.3" fill="#336791"/></svg>`

const RSS_ICON = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/></svg>`

export function renderFeedLandingHtml(
  items: FeedLandingItem[],
  { feedUrl, siteUrl }: FeedLandingOptions
): string {
  const encodedFeed = encodeURIComponent(feedUrl)

  const issueList = items
    .map((item) => {
      const meta =
        item.posts != null && item.participants != null
          ? `<span class="issue-meta">${item.posts} posts &middot; ${item.participants} people</span>`
          : ''
      return `      <li class="issue">
        <div class="issue-head">
          <span class="issue-date">${formatDisplayDate(item.isoDate)}</span>
          ${meta}
        </div>
        <a class="issue-title" href="${escapeHtml(item.link)}">${escapeHtml(item.title)}</a>
        <p class="issue-desc">${escapeHtml(item.description)}</p>
      </li>`
    })
    .join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex" />
  <title>RSS feed — PostgreSQL Hackers Digest</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg: #f8fafc;
      --card: #ffffff;
      --border: #e2e8f0;
      --text: #111827;
      --text-secondary: #4b5563;
      --text-muted: #6b7280;
      --link: #336791;
      --link-hover: #3d7cae;
      --code-bg: #f0f4f8;
      --btn-bg: #336791;
      --btn-text: #ffffff;
      --btn-2-bg: transparent;
      --btn-2-border: #bcccdc;
      --badge-bg: #f0f4f8;
      --badge-text: #336791;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0d1117;
        --card: #1a2332;
        --border: #1e293b;
        --text: #f3f4f6;
        --text-secondary: #9ca3af;
        --text-muted: #6b7280;
        --link: #58a6ff;
        --link-hover: #79c0ff;
        --code-bg: #102a43;
        --btn-bg: #336791;
        --btn-text: #ffffff;
        --btn-2-bg: transparent;
        --btn-2-border: #334155;
        --badge-bg: rgba(56, 139, 253, 0.15);
        --badge-text: #58a6ff;
      }
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
    }
    .mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }
    a { color: var(--link); text-decoration: none; }
    a:hover { color: var(--link-hover); }
    .wrap { max-width: 660px; margin: 0 auto; padding: 0 20px 64px; }
    header {
      display: flex; align-items: center; gap: 12px;
      padding: 24px 0; margin-bottom: 36px;
      border-bottom: 1px solid var(--border);
    }
    header svg { flex-shrink: 0; }
    .brand { font-weight: 600; color: var(--text); font-size: 16px; }
    .badge {
      display: inline-flex; align-items: center; gap: 6px;
      font-family: 'JetBrains Mono', ui-monospace, monospace;
      font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.08em;
      background: var(--badge-bg); color: var(--badge-text);
      padding: 4px 10px; border-radius: 6px; margin-bottom: 16px;
    }
    h1 { font-size: 28px; font-weight: 700; letter-spacing: -0.02em; margin-bottom: 12px; }
    .lede { color: var(--text-secondary); font-size: 15.5px; max-width: 560px; }
    .lede a { font-weight: 500; }
    .url-box {
      display: block; margin: 24px 0 14px;
      background: var(--code-bg); border: 1px solid var(--border);
      border-radius: 10px; padding: 14px 16px;
      font-family: 'JetBrains Mono', ui-monospace, monospace;
      font-size: 13.5px; color: var(--text);
      word-break: break-all; user-select: all;
    }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 8px; }
    .btn {
      display: inline-flex; align-items: center; gap: 7px;
      font-size: 14px; font-weight: 500;
      padding: 9px 16px; border-radius: 8px;
      transition: opacity 0.15s, background 0.15s;
    }
    .btn-primary { background: var(--btn-bg); color: var(--btn-text) !important; }
    .btn-primary:hover { opacity: 0.9; }
    .btn-outline { background: var(--btn-2-bg); border: 1px solid var(--btn-2-border); color: var(--text); }
    .btn-outline:hover { border-color: var(--link); color: var(--link); }
    .email-alt { font-size: 13.5px; color: var(--text-muted); margin-top: 14px; }
    section.issues { margin-top: 52px; }
    .eyebrow {
      font-family: 'JetBrains Mono', ui-monospace, monospace;
      font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.08em;
      color: var(--badge-text); margin-bottom: 18px;
    }
    ul.issue-list { list-style: none; }
    .issue {
      background: var(--card); border: 1px solid var(--border); border-radius: 12px;
      padding: 18px 20px; margin-bottom: 12px;
    }
    .issue-head { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 4px; }
    .issue-date, .issue-meta {
      font-family: 'JetBrains Mono', ui-monospace, monospace;
      font-size: 11.5px; color: var(--text-muted);
    }
    .issue-title { font-size: 16px; font-weight: 600; display: inline-block; margin-bottom: 6px; color: var(--text); }
    .issue-title:hover { color: var(--link); }
    .issue-desc {
      font-size: 13.5px; color: var(--text-secondary);
      display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
    }
    footer { margin-top: 44px; padding-top: 20px; border-top: 1px solid var(--border); font-size: 14px; }
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      ${LOGO_SVG}
      <span class="brand">PostgreSQL Hackers Digest</span>
    </header>

    <main>
      <span class="badge">${RSS_ICON} RSS feed</span>
      <h1>You found the RSS feed</h1>
      <p class="lede">
        This page is a feed, not a regular website. Copy the URL below into your
        feed reader — Feedly, Inoreader, NetNewsWire, or any other — and every new
        weekly digest will show up there automatically, every Friday.
        New to RSS? <a href="https://aboutfeeds.com" rel="noopener">Here's a friendly intro</a>.
      </p>

      <code class="url-box">${escapeHtml(feedUrl)}</code>

      <div class="actions">
        <a class="btn btn-primary" href="https://feedly.com/i/subscription/feed%2F${encodedFeed}" rel="noopener">Follow on Feedly</a>
        <a class="btn btn-outline" href="https://www.inoreader.com/feed/${encodedFeed}" rel="noopener">Follow on Inoreader</a>
      </div>
      <p class="email-alt">
        Prefer email? <a href="${escapeHtml(siteUrl)}">Subscribe to the newsletter</a> instead.
      </p>

      <section class="issues">
        <p class="eyebrow">Latest issues</p>
        <ul class="issue-list">
${issueList}
        </ul>
      </section>
    </main>

    <footer>
      <a href="${escapeHtml(siteUrl)}">&larr; Back to postgreshackersdigest.dev</a>
    </footer>
  </div>
</body>
</html>
`
}
