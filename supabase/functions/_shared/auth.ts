// Reject the request unless the Authorization header carries the service role
// key. Use this on edge functions that should only be invoked from cron / other
// edge functions / trusted backends.
export function requireServiceRole(req: Request): Response | null {
  const auth = req.headers.get('Authorization') ?? ''
  const token = auth.replace(/^Bearer\s+/i, '').trim()
  const expected = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  if (!token || !expected || token.length !== expected.length) {
    return unauthorized()
  }
  let diff = 0
  for (let i = 0; i < token.length; i++) {
    diff |= token.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  if (diff !== 0) return unauthorized()
  return null
}

function unauthorized(): Response {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  })
}
