import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { clientIp, isWithinRateLimit } from '../_shared/rate-limit.ts'
import { createAdminClient } from '../_shared/supabase-admin.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Neutral message returned for every outcome to prevent enumeration of
// existing subscribers via timing / response differences.
const NEUTRAL_MESSAGE =
  'If this address is eligible, a confirmation email is on its way. Please check your inbox.'

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

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const siteUrl = typeof body.siteUrl === 'string' ? body.siteUrl.trim() : ''

  if (!email || email.length > 254 || !EMAIL_REGEX.test(email)) {
    return jsonResponse({ success: false, error: 'Please enter a valid email address.' }, 400)
  }

  const confirmationBase = resolveConfirmationBase(siteUrl)
  if (!confirmationBase) {
    console.error('subscribe: no allowed site URL resolved')
    return jsonResponse({ success: false, error: 'Subscription temporarily unavailable.' }, 500)
  }

  let supabase
  try {
    supabase = createAdminClient()
  } catch (err) {
    console.error('subscribe: admin client init failed', err)
    return jsonResponse({ success: false, error: 'Subscription temporarily unavailable.' }, 500)
  }

  const ip = clientIp(req)
  const rateBuckets = [`subscribe:email:${email}`]
  if (ip) rateBuckets.push(`subscribe:ip:${ip}`)
  for (const bucket of rateBuckets) {
    const allowed = await isWithinRateLimit(supabase, bucket, 5, 3600)
    if (!allowed) {
      return jsonResponse({ success: true, message: NEUTRAL_MESSAGE })
    }
  }

  try {
    const { data: result, error: rpcError } = await supabase.rpc('initiate_subscription', {
      p_email: email,
    })

    if (rpcError) {
      console.error('subscribe: initiate_subscription failed', rpcError)
      return jsonResponse({ success: false, error: 'Subscription temporarily unavailable.' }, 500)
    }

    if (!result?.ok) {
      if (result?.error === 'invalid_email') {
        return jsonResponse({ success: false, error: 'Please enter a valid email address.' }, 400)
      }
      return jsonResponse({ success: false, error: 'Subscription temporarily unavailable.' }, 500)
    }

    const action = result.action as string
    if (action === 'send_confirmation' && typeof result.confirmation_token === 'string') {
      const confirmationUrl =
        `${confirmationBase}/confirm?token=${encodeURIComponent(result.confirmation_token)}`
      const sent = await sendConfirmationEmail(email, confirmationUrl, confirmationBase)
      if (!sent) {
        console.error('subscribe: confirmation email send failed for', email)
      }
    }

    return jsonResponse({ success: true, message: NEUTRAL_MESSAGE })
  } catch (err) {
    console.error('subscribe: unexpected error', err)
    return jsonResponse({ success: false, error: 'Subscription temporarily unavailable.' }, 500)
  }
})

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// Allowlist for the site URL the confirmation link points at. The frontend
// passes window.location.origin; we only honor it if it matches a known host
// or the default production domain. Falls back to the production domain.
function resolveConfirmationBase(requested: string): string | null {
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
    } catch (_) {
      // ignore
    }
  }
  return 'https://postgreshackersdigest.dev'
}

async function sendConfirmationEmail(
  email: string,
  confirmationUrl: string,
  siteBase: string,
): Promise<boolean> {
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  if (!resendApiKey) {
    console.error('subscribe: RESEND_API_KEY not configured')
    return false
  }

  const html = createConfirmationEmailContent(confirmationUrl, siteBase)

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'PostgreSQL Hackers Digest <digest@postgreshackersdigest.dev>',
        to: [email],
        subject: 'Confirm your subscription to PostgreSQL Hackers Digest',
        html,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`subscribe: Resend ${response.status} - ${errorText}`)
      return false
    }
    return true
  } catch (err) {
    console.error('subscribe: Resend fetch failed', err)
    return false
  }
}

function createConfirmationEmailContent(confirmationUrl: string, siteBase: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirm Your Subscription</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 500px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; margin-bottom: 30px; }
    .button { display: inline-block; background: #336791; color: white !important; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
    .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; border-top: 1px solid #eee; padding-top: 20px; }
    .footer a { color: #666; text-decoration: none; }
    .warning { background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 12px; border-radius: 4px; margin: 15px 0; font-size: 14px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🐘 Confirm Your Subscription</h1>
    <p style="color: #666; margin: 0;">PostgreSQL Hackers Digest</p>
  </div>

  <p>Hi there!</p>
  <p>You've subscribed (or re-subscribed) to receive weekly AI-powered summaries of the most important discussions from the PostgreSQL hackers mailing list.</p>
  <p><strong>Please confirm your subscription by clicking the button below:</strong></p>

  <div style="text-align: center; margin: 25px 0;">
    <a href="${confirmationUrl}" class="button">✓ Confirm Subscription</a>
  </div>

  <div class="warning">
    <strong>⏰ Important:</strong> This confirmation link expires in 5 minutes for security.
  </div>

  <p><strong>What you'll get:</strong></p>
  <ul style="margin: 15px 0;">
    <li>Weekly digest of top 10 PostgreSQL discussions</li>
    <li>Delivered every Monday to your inbox</li>
    <li>Curated by AI to save you time</li>
  </ul>

  <p style="font-size: 14px; color: #666;">If you didn't request this email, you can safely ignore it; nothing further will happen.</p>

  <div class="footer">
    <p>This service is not affiliated with the PostgreSQL Global Development Group.</p>
    <p>&copy; ${new Date().getFullYear()} PostgreSQL Weekly Summary &middot; <a href="${siteBase}">${siteBase.replace(/^https?:\/\//, '')}</a></p>
  </div>
</body>
</html>`
}
