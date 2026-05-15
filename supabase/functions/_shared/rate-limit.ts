import { type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

/** Returns true if the request is within the rate limit. */
export async function isWithinRateLimit(
  supabase: SupabaseClient,
  bucketKey: string,
  maxRequests: number,
  windowSeconds: number,
): Promise<boolean> {
  const windowStart = new Date(Date.now() - windowSeconds * 1000).toISOString()

  const { count, error: countError } = await supabase
    .from('api_rate_limits')
    .select('*', { count: 'exact', head: true })
    .eq('bucket_key', bucketKey)
    .gte('created_at', windowStart)

  if (countError) {
    console.error('rate-limit: count failed', countError)
    // Fail open so a DB glitch does not block legitimate users.
    return true
  }

  if ((count ?? 0) >= maxRequests) {
    return false
  }

  const { error: insertError } = await supabase
    .from('api_rate_limits')
    .insert({ bucket_key: bucketKey })

  if (insertError) {
    console.error('rate-limit: insert failed', insertError)
  }

  return true
}

export function clientIp(req: Request): string | null {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  return req.headers.get('cf-connecting-ip') ?? req.headers.get('x-real-ip')
}
