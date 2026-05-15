import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { clientIp, isWithinRateLimit } from '../_shared/rate-limit.ts'
import { createAdminClient } from '../_shared/supabase-admin.ts'
import { makeUnsubscribeToken, normalizeEmail } from '../_shared/unsubscribe-token.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const NEUTRAL_MESSAGE =
  'If this address is on our list, an unsubscribe confirmation email is on its way.'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405)
  }

  let body: { email?: unknown; siteUrl?: unknown }
  try {
    body = await req.json()
  } catch (_) {
    return jsonResponse({ success: false, error: 'Invalid JSON body' }, 400)
  }

  const rawEmail = typeof body.email === 'string' ? body.email : ''
  const email = normalizeEmail(rawEmail)
  const siteUrl = typeof body.siteUrl === 'string' ? body.siteUrl.trim() : ''

  if (!email || email.length > 254 || !EMAIL_REGEX.test(email)) {
    return jsonResponse({ success: false, error: 'Please enter a valid email address.' }, 400)
  }

  const siteBase = resolveSiteBase(siteUrl)

  let supabase
  try {
    supabase = createAdminClient()
  } catch (err) {
    console.error('request-unsubscribe: admin client init failed', err)
    return jsonResponse({ success: false, error: 'Service temporarily unavailable.' }, 500)
  }

  const ip = clientIp(req)
  const rateBuckets = [`unsubscribe:email:${email}`]
  if (ip) rateBuckets.push(`unsubscribe:ip:${ip}`)
  for (const bucket of rateBuckets) {
    const allowed = await isWithinRateLimit(supabase, bucket, 5, 3600)
    if (!allowed) {
      return jsonResponse({ success: true, message: NEUTRAL_MESSAGE })
    }
  }

  try {
    // Only send the email if the address is actually subscribed and active.
    // We always return the same neutral message to prevent enumeration.
    const { data: subscriber, error: lookupError } = await supabase
      .from('subscribers')
      .select('id, email, is_active, confirmation_status')
      .eq('email', email)
      .maybeSingle()

    if (lookupError) {
      console.error('request-unsubscribe: lookup failed', lookupError)
      return jsonResponse({ success: false, error: 'Service temporarily unavailable.' }, 500)
    }

    if (subscriber && subscriber.is_active && subscriber.confirmation_status === 'confirmed') {
      const token = await makeUnsubscribeToken(email)
      const url = `${siteBase}/unsubscribe?email=${encodeURIComponent(email)}&token=${token}`
      await sendUnsubscribeEmail(email, url, siteBase)
    }

    return jsonResponse({ success: true, message: NEUTRAL_MESSAGE })
  } catch (err) {
    console.error('request-unsubscribe: unexpected error', err)
    return jsonResponse({ success: false, error: 'Service temporarily unavailable.' }, 500)
  }
})

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function resolveSiteBase(requested: string): string {
  const allowed = new Set<string>([
    'https://postgreshackersdigest.dev',
    'https://www.postgreshackersdigest.dev',
  ])
  const extras = (Deno.env.get('ALLOWED_SITE_ORIGINS') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  for (const origin of extras) allowed.add(origin)
  if (requested) {
    try {
      const u = new URL(requested)
      const origin = `${u.protocol}//${u.host}`
      if (allowed.has(origin)) return origin
      if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return origin
    } catch (_) { /* ignore */ }
  }
  return 'https://postgreshackersdigest.dev'
}

async function sendUnsubscribeEmail(email: string, url: string, siteBase: string): Promise<void> {
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  if (!resendApiKey) {
    console.error('request-unsubscribe: RESEND_API_KEY not configured')
    return
  }
  const html = createEmail(url, siteBase)
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'PostgreSQL Hackers Digest <digest@postgreshackersdigest.dev>',
      to: [email],
      subject: 'Confirm unsubscribe from PostgreSQL Hackers Digest',
      html,
    }),
  })
  if (!response.ok) {
    const errorText = await response.text()
    console.error(`request-unsubscribe: Resend ${response.status} - ${errorText}`)
  }
}

function createEmail(url: string, siteBase: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Confirm unsubscribe</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 500px; margin: 0 auto; padding: 20px; }
    .button { display: inline-block; background: #b91c1c; color: white !important; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
    .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; border-top: 1px solid #eee; padding-top: 20px; }
  </style>
</head>
<body>
  <h2>Confirm unsubscribe</h2>
  <p>We received a request to unsubscribe this address from PostgreSQL Hackers Digest.</p>
  <p>If you made this request, click the button below to complete it:</p>
  <p style="text-align: center;"><a href="${url}" class="button">Confirm unsubscribe</a></p>
  <p style="font-size: 14px; color: #666;">If you didn't request this, just ignore this email and you'll stay subscribed.</p>
  <div class="footer">
    <p>&copy; ${new Date().getFullYear()} PostgreSQL Weekly Summary &middot; ${siteBase.replace(/^https?:\/\//, '')}</p>
  </div>
</body>
</html>`
}
