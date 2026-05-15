// Allowlist for thread redirect targets (stored thread_url values).
const ALLOWED_REDIRECT_HOSTS = new Set([
  'www.postgrespro.com',
  'postgrespro.com',
])

export function isAllowedRedirectUrl(rawUrl: string): boolean {
  if (!rawUrl || rawUrl.length > 2048) return false
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return false
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false
  if (parsed.username || parsed.password) return false
  return ALLOWED_REDIRECT_HOSTS.has(parsed.hostname.toLowerCase())
}
