// HMAC-SHA256 unsubscribe token. The secret is the unsubscribe HMAC key,
// which must be set as the UNSUBSCRIBE_HMAC_SECRET edge function secret.
// We deliberately do NOT fall back to SUPABASE_SERVICE_ROLE_KEY: rotating
// the service role key should not silently invalidate every unsubscribe link.

const ENC = new TextEncoder()

function getSecret(): string {
  const secret = Deno.env.get('UNSUBSCRIBE_HMAC_SECRET')
  if (!secret || secret.length < 32) {
    throw new Error(
      'UNSUBSCRIBE_HMAC_SECRET is not configured (set it to a random value of >= 32 chars in the Supabase Edge Functions dashboard).',
    )
  }
  return secret
}

async function sign(message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    ENC.encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, ENC.encode(message))
  return new Uint8Array(sig)
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export async function makeUnsubscribeToken(email: string): Promise<string> {
  const sig = await sign(normalizeEmail(email))
  return base64UrlEncode(sig)
}

export async function verifyUnsubscribeToken(email: string, token: string): Promise<boolean> {
  if (!email || !token) return false
  const expected = await makeUnsubscribeToken(email)
  return timingSafeEqual(ENC.encode(expected), ENC.encode(token))
}
