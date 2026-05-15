import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export function createAdminClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey =
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY')

  if (!url || !serviceRoleKey) {
    throw new Error(
      'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured for this edge function',
    )
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
