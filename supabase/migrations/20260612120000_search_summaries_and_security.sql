-- Search summaries RPC for archive search
CREATE OR REPLACE FUNCTION search_summaries(
  search_query TEXT,
  result_limit INTEGER DEFAULT 20,
  result_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  week_start_date DATE,
  week_end_date DATE,
  total_posts INTEGER,
  total_participants INTEGER,
  created_at TIMESTAMPTZ,
  top_discussions JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ws.id,
    ws.week_start_date,
    ws.week_end_date,
    ws.total_posts,
    ws.total_participants,
    ws.created_at,
    ws.top_discussions
  FROM weekly_summaries ws
  WHERE
    ws.summary_content ILIKE '%' || search_query || '%'
    OR ws.top_discussions::text ILIKE '%' || search_query || '%'
  ORDER BY ws.week_start_date DESC
  LIMIT result_limit
  OFFSET result_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION search_summaries(TEXT, INTEGER, INTEGER) TO anon, authenticated, service_role;

-- Fix refresh_commitfest_tags to use service role key instead of anon key
CREATE OR REPLACE FUNCTION refresh_commitfest_tags()
RETURNS bigint AS $$
DECLARE
  request_id bigint;
  supabase_url text;
  service_key text;
  webhook_url text;
BEGIN
  supabase_url := get_app_secret('supabase_url');
  service_key := get_app_secret('supabase_service_role_key');

  webhook_url := supabase_url || '/functions/v1/sync-commitfest-tags';

  SELECT net.http_post(
    url := webhook_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(service_key, '')
    ),
    body := jsonb_build_object(
      'source', 'database_function',
      'triggered_at', NOW()
    )
  ) INTO request_id;

  RETURN request_id;
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Failed to call sync-commitfest-tags: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Revoke public read on cron_schedule (leaks job names/timing)
REVOKE SELECT ON cron_schedule FROM anon, authenticated;

-- Harden confirm_subscription and cleanup_expired_confirmations
REVOKE ALL ON FUNCTION confirm_subscription(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION confirm_subscription(TEXT) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION cleanup_expired_confirmations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cleanup_expired_confirmations() TO service_role;

REVOKE ALL ON FUNCTION generate_confirmation_token() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION generate_confirmation_token() TO service_role;
