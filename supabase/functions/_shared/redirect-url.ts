// Allowlist for thread redirect targets (stored thread_url values).
const ALLOWED_REDIRECT_HOSTS = new Set([
  'www.postgrespro.com',
  'postgrespro.com',
  'www.postgresql.org',
  'postgresql.org',
])

const POSTGRES_ORG_ARCHIVE = 'https://www.postgresql.org'
const POSTGRESPRO_LIST_ID_PATH = /^\/list\/id\/(.+)$/i

/** Map legacy postgrespro.com archive URLs to postgresql.org message-id URLs. */
export function resolveRedirectTarget(storedUrl: string): string | null {
  if (!storedUrl || storedUrl.length > 2048) return null

  let parsed: URL
  try {
    parsed = new URL(storedUrl)
  } catch {
    return null
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null
  if (parsed.username || parsed.password) return null

  const host = parsed.hostname.toLowerCase()
  if (host === 'postgrespro.com' || host === 'www.postgrespro.com') {
    const match = parsed.pathname.match(POSTGRESPRO_LIST_ID_PATH)
    if (!match) return null
    // Keep the message-id segment as stored (encoding preserved for postgresql.org).
    return `${POSTGRES_ORG_ARCHIVE}/message-id/${match[1]}`
  }

  if (ALLOWED_REDIRECT_HOSTS.has(host)) {
    return parsed.toString()
  }

  return null
}

export function isAllowedRedirectUrl(rawUrl: string): boolean {
  const resolved = resolveRedirectTarget(rawUrl)
  if (!resolved) return false
  try {
    const parsed = new URL(resolved)
    return ALLOWED_REDIRECT_HOSTS.has(parsed.hostname.toLowerCase())
  } catch {
    return false
  }
}
