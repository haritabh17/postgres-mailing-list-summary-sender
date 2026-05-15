import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createAdminClient } from '../_shared/supabase-admin.ts'
import { normalizeEmail, verifyUnsubscribeToken } from '../_shared/unsubscribe-token.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST' && req.method !== 'GET') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405)
  }

  let email = ''
  let token = ''
  if (req.method === 'GET') {
    const url = new URL(req.url)
    email = url.searchParams.get('email') ?? ''
    token = url.searchParams.get('token') ?? ''
  } else {
    try {
      const body = await req.json()
      email = typeof body.email === 'string' ? body.email : ''
      token = typeof body.token === 'string' ? body.token : ''
    } catch (_) {
      return jsonResponse({ success: false, error: 'Invalid JSON body' }, 400)
    }
  }

  email = normalizeEmail(email)

  if (!email || !token) {
    return jsonResponse({ success: false, error: 'Missing email or token.' }, 400)
  }

  let valid = false
  try {
    valid = await verifyUnsubscribeToken(email, token)
  } catch (err) {
    console.error('confirm-unsubscribe: token verification failed', err)
    return jsonResponse({ success: false, error: 'Service temporarily unavailable.' }, 500)
  }

  if (!valid) {
    return jsonResponse({ success: false, error: 'Invalid or expired unsubscribe link.' }, 400)
  }

  let supabase
  try {
    supabase = createAdminClient()
  } catch (err) {
    console.error('confirm-unsubscribe: admin client init failed', err)
    return jsonResponse({ success: false, error: 'Service temporarily unavailable.' }, 500)
  }

  try {
    const { data, error } = await supabase
      .from('subscribers')
      .update({
        is_active: false,
        confirmation_status: 'unsubscribed',
        confirmation_token: null,
        confirmation_expires_at: null,
        confirmed_at: null,
      })
      .eq('email', email)
      .select('id')

    if (error) {
      console.error('confirm-unsubscribe: update failed', error)
      return jsonResponse({ success: false, error: 'Service temporarily unavailable.' }, 500)
    }

    if (!data || data.length === 0) {
      // Treat unknown email like a successful no-op so we don't reveal which
      // addresses are on the list.
      return jsonResponse({
        success: true,
        message: 'You have been unsubscribed.',
      })
    }

    return jsonResponse({
      success: true,
      message: 'You have been unsubscribed. You can resubscribe any time from our homepage.',
    })
  } catch (err) {
    console.error('confirm-unsubscribe: unexpected error', err)
    return jsonResponse({ success: false, error: 'Service temporarily unavailable.' }, 500)
  }
})

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
