-- Security hardening follow-up to 20260424000001_lockdown_security.sql:
--   * Cron HTTP calls use service role bearer (not anon)
--   * Pipeline tables locked behind RLS
--   * Rate-limit table for public edge functions
--   * confirm_subscription no longer returns email in JSON

-- ============================================================================
-- Service role key for cron → edge function auth (set via set_app_secret in prod)
-- ============================================================================

INSERT INTO public.app_secrets (key, value, description) VALUES
(
  'supabase_service_role_key',
  'your-service-role-key-here',
  'Service role JWT for pg_cron HTTP calls to gated edge functions'
)
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- Rate limiting (used by subscribe / request-unsubscribe edge functions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_rate_limits_bucket_created
  ON public.api_rate_limits (bucket_key, created_at DESC);

ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role only" ON public.api_rate_limits;
CREATE POLICY "Service role only" ON public.api_rate_limits
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

REVOKE ALL ON public.api_rate_limits FROM anon, authenticated, PUBLIC;

-- ============================================================================
-- Pipeline tables: RLS service_role only
-- ============================================================================

ALTER TABLE public.mail_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mail_thread_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_discussions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access" ON public.mail_threads;
CREATE POLICY "Service role full access" ON public.mail_threads
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access" ON public.mail_thread_contents;
CREATE POLICY "Service role full access" ON public.mail_thread_contents
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access" ON public.weekly_discussions;
CREATE POLICY "Service role full access" ON public.weekly_discussions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

REVOKE ALL ON public.mail_threads FROM anon, authenticated, PUBLIC;
REVOKE ALL ON public.mail_thread_contents FROM anon, authenticated, PUBLIC;
REVOKE ALL ON public.weekly_discussions FROM anon, authenticated, PUBLIC;

-- ============================================================================
-- confirm_subscription: do not return subscriber email in API response
-- ============================================================================

CREATE OR REPLACE FUNCTION public.confirm_subscription(token_value TEXT)
RETURNS JSON AS $$
DECLARE
  subscriber_record RECORD;
  result JSON;
BEGIN
  SELECT * INTO subscriber_record
  FROM subscribers
  WHERE confirmation_token = token_value
    AND confirmation_status = 'pending_confirmation'
    AND confirmation_expires_at > NOW();

  IF FOUND THEN
    UPDATE subscribers
    SET confirmation_status = 'confirmed',
        is_active = true,
        confirmed_at = NOW()
    WHERE id = subscriber_record.id;

    result := json_build_object(
      'success', true,
      'message', 'Subscription confirmed successfully! Welcome to PostgreSQL Weekly Summary.'
    );
    RETURN result;
  END IF;

  SELECT * INTO subscriber_record
  FROM subscribers
  WHERE confirmation_token = token_value
    AND confirmation_status = 'confirmed'
    AND is_active = true;

  IF FOUND THEN
    result := json_build_object(
      'success', true,
      'message', 'You are already subscribed to PostgreSQL Weekly Summary! No action needed.'
    );
    RETURN result;
  END IF;

  SELECT * INTO subscriber_record
  FROM subscribers
  WHERE confirmation_token = token_value;

  IF FOUND THEN
    result := json_build_object(
      'success', false,
      'message', 'This confirmation link has expired. Please subscribe again to receive a new confirmation email.'
    );
    RETURN result;
  END IF;

  result := json_build_object(
    'success', false,
    'message', 'Invalid confirmation link. This link may have been tampered with or is from an old subscription attempt.'
  );
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Cron triggers: Authorization Bearer uses service role key
-- ============================================================================

CREATE OR REPLACE FUNCTION public.trigger_fetch_mail_threads()
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
  request_id bigint;
  supabase_url text;
  service_key text;
  function_url text;
BEGIN
  supabase_url := get_app_secret('supabase_url');
  service_key := get_app_secret('supabase_service_role_key');

  INSERT INTO processing_logs (process_type, status, message, metadata, started_at)
  VALUES ('cron_trigger', 'in_progress', 'Starting cron job to call fetch-mail-threads',
          jsonb_build_object(
            'triggered_at', NOW(),
            'task_type', 'fetch_mail_threads',
            'schedule', 'hourly',
            'method', 'http_post'
          ), NOW());

  INSERT INTO cron_schedule (task_name, schedule_expression, last_run_at, next_run_at)
  VALUES (
    'fetch-mail-threads-hourly',
    '0 * * * *',
    NOW(),
    NOW() + INTERVAL '1 hour'
  )
  ON CONFLICT (task_name) DO UPDATE SET
    last_run_at = NOW(),
    next_run_at = NOW() + INTERVAL '1 hour',
    updated_at = NOW()
  WHERE cron_schedule.task_name = 'fetch-mail-threads-hourly';

  BEGIN
    function_url := supabase_url || '/functions/v1/fetch-mail-threads';

    SELECT net.http_post(
      url := function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || COALESCE(service_key, '')
      ),
      body := jsonb_build_object(
        'source', 'database_cron',
        'triggered_at', NOW(),
        'cron_job', 'fetch-mail-threads-hourly'
      )
    ) INTO request_id;

    INSERT INTO processing_logs (process_type, status, message, metadata, completed_at)
    VALUES ('cron_trigger', 'success', 'HTTP request sent to fetch-mail-threads Edge Function',
            jsonb_build_object(
              'request_id', request_id,
              'function_url', function_url,
              'method', 'http_post'
            ), NOW());

  EXCEPTION WHEN OTHERS THEN
    INSERT INTO processing_logs (process_type, status, message, metadata, completed_at)
    VALUES ('cron_trigger', 'error', 'Failed to call fetch-mail-threads: ' || SQLERRM,
            jsonb_build_object(
              'error_detail', SQLSTATE,
              'function_url', function_url,
              'error_message', SQLERRM
            ), NOW());
  END;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_fetch_thread_content()
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
  request_id bigint;
  supabase_url text;
  service_key text;
  function_url text;
BEGIN
  supabase_url := get_app_secret('supabase_url');
  service_key := get_app_secret('supabase_service_role_key');

  INSERT INTO processing_logs (process_type, status, message, metadata, started_at)
  VALUES ('cron_trigger', 'in_progress', 'Starting cron job to call fetch-thread-content',
          jsonb_build_object(
            'triggered_at', NOW(),
            'task_type', 'fetch_thread_content',
            'schedule', 'every_10_minutes',
            'method', 'http_post'
          ), NOW());

  INSERT INTO cron_schedule (task_name, schedule_expression, last_run_at, next_run_at)
  VALUES (
    'fetch-thread-content-every-10-min',
    '*/10 * * * *',
    NOW(),
    NOW() + INTERVAL '10 minutes'
  )
  ON CONFLICT (task_name) DO UPDATE SET
    last_run_at = NOW(),
    next_run_at = NOW() + INTERVAL '10 minutes',
    updated_at = NOW()
  WHERE cron_schedule.task_name = 'fetch-thread-content-every-10-min';

  BEGIN
    function_url := supabase_url || '/functions/v1/fetch-thread-content';

    SELECT net.http_post(
      url := function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || COALESCE(service_key, '')
      ),
      body := jsonb_build_object(
        'source', 'database_cron',
        'triggered_at', NOW(),
        'cron_job', 'fetch-thread-content-every-10-min'
      )
    ) INTO request_id;

    INSERT INTO processing_logs (process_type, status, message, metadata, completed_at)
    VALUES ('cron_trigger', 'success', 'HTTP request sent to fetch-thread-content Edge Function',
            jsonb_build_object(
              'request_id', request_id,
              'function_url', function_url,
              'method', 'http_post'
            ), NOW());

  EXCEPTION WHEN OTHERS THEN
    INSERT INTO processing_logs (process_type, status, message, metadata, completed_at)
    VALUES ('cron_trigger', 'error', 'Failed to call fetch-thread-content: ' || SQLERRM,
            jsonb_build_object(
              'error_detail', SQLSTATE,
              'function_url', function_url,
              'error_message', SQLERRM
            ), NOW());
  END;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_generate_summary_for_date(week_end_date DATE)
RETURNS jsonb
LANGUAGE plpgsql
AS $function$
DECLARE
  request_id bigint;
  webhook_url text;
  service_key text;
  week_start_date DATE;
  day_of_week INTEGER;
BEGIN
  day_of_week := EXTRACT(DOW FROM week_end_date);

  IF day_of_week = 5 THEN
    week_start_date := week_end_date - INTERVAL '7 days';
  ELSIF day_of_week = 6 THEN
    week_start_date := week_end_date - INTERVAL '1 day';
  ELSE
    week_start_date := week_end_date - INTERVAL '1 day' * (day_of_week + 2);
  END IF;

  webhook_url := get_app_secret('supabase_url') || '/functions/v1/generate-summary';
  service_key := get_app_secret('supabase_service_role_key');

  INSERT INTO processing_logs (process_type, status, message, metadata, started_at)
  VALUES ('summary_generation', 'in_progress', 'Starting summary generation for custom date range',
          jsonb_build_object(
            'triggered_at', NOW(),
            'week_start_date', week_start_date,
            'week_end_date', week_end_date,
            'task_type', 'generate_summary_custom_date',
            'method', 'http_post'
          ), NOW());

  BEGIN
    SELECT net.http_post(
      url := webhook_url,
      headers := jsonb_build_object(
        'User-Agent', 'PostgreSQL-Function/1.0',
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      body := jsonb_build_object(
        'weekStart', week_start_date::text,
        'weekEnd', week_end_date::text
      )
    ) INTO request_id;

    INSERT INTO processing_logs (process_type, status, message, metadata, completed_at)
    VALUES ('summary_generation', 'success', 'HTTP request sent for summary generation',
            jsonb_build_object(
              'request_id', request_id,
              'week_start_date', week_start_date,
              'week_end_date', week_end_date,
              'method', 'http_post'
            ), NOW());

    RETURN jsonb_build_object(
      'success', true,
      'message', 'Summary generation initiated',
      'request_id', request_id,
      'week_start_date', week_start_date,
      'week_end_date', week_end_date
    );

  EXCEPTION WHEN OTHERS THEN
    INSERT INTO processing_logs (process_type, status, message, metadata, completed_at)
    VALUES ('summary_generation', 'error', 'Failed to call summary generation: ' || SQLERRM,
            jsonb_build_object(
              'error_detail', SQLSTATE,
              'error_message', SQLERRM,
              'week_start_date', week_start_date,
              'week_end_date', week_end_date
            ), NOW());

    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
  END;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_sync_commitfest_data()
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
  request_id bigint;
  supabase_url text;
  service_key text;
  webhook_url text;
BEGIN
  supabase_url := get_app_secret('supabase_url');
  service_key := get_app_secret('supabase_service_role_key');

  INSERT INTO processing_logs (process_type, status, message, metadata, started_at)
  VALUES ('cron_trigger', 'in_progress', 'Starting cron job to call sync-commitfest-data',
          jsonb_build_object(
            'triggered_at', NOW(),
            'task_type', 'sync_commitfest_data',
            'schedule', 'weekly',
            'method', 'http_post'
          ), NOW());

  INSERT INTO cron_schedule (task_name, schedule_expression, last_run_at, next_run_at)
  VALUES (
    'sync-commitfest-data-weekly',
    '0 2 * * 1',
    NOW(),
    NOW() + INTERVAL '7 days'
  )
  ON CONFLICT (task_name) DO UPDATE SET
    last_run_at = NOW(),
    next_run_at = NOW() + INTERVAL '7 days',
    updated_at = NOW()
  WHERE cron_schedule.task_name = 'sync-commitfest-data-weekly';

  BEGIN
    webhook_url := supabase_url || '/functions/v1/sync-commitfest-data';

    SELECT net.http_post(
      url := webhook_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || COALESCE(service_key, '')
      ),
      body := jsonb_build_object(
        'source', 'database_cron',
        'triggered_at', NOW(),
        'cron_job', 'sync-commitfest-data-weekly'
      )
    ) INTO request_id;

    INSERT INTO processing_logs (process_type, status, message, metadata, completed_at)
    VALUES ('cron_trigger', 'success', 'HTTP request sent to sync-commitfest-data Edge Function',
            jsonb_build_object(
              'request_id', request_id,
              'webhook_url', webhook_url,
              'method', 'http_post'
            ), NOW());

  EXCEPTION WHEN OTHERS THEN
    INSERT INTO processing_logs (process_type, status, message, metadata, completed_at)
    VALUES ('cron_trigger', 'error', 'Failed to call sync-commitfest-data: ' || SQLERRM,
            jsonb_build_object(
              'error_detail', SQLSTATE,
              'webhook_url', webhook_url,
              'error_message', SQLERRM
            ), NOW());
  END;
END;
$function$;

-- Batch email send: match send-summary-to-user requireServiceRole gate
CREATE OR REPLACE FUNCTION public.send_latest_summary_to_users(user_emails TEXT[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  function_url TEXT;
  service_key TEXT;
  request_id BIGINT;
BEGIN
  IF user_emails IS NULL OR array_length(user_emails, 1) IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Email list is required and cannot be empty'
    );
  END IF;

  BEGIN
    function_url := get_app_secret('supabase_url') || '/functions/v1/send-summary-to-user';
    service_key := get_app_secret('supabase_service_role_key');
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Failed to retrieve configuration: ' || SQLERRM
    );
  END;

  BEGIN
    SELECT net.http_post(
      url := function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      body := jsonb_build_object('emails', user_emails)
    ) INTO request_id;

    IF request_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true,
        'message', 'Email batch processing initiated',
        'request_id', request_id,
        'note', 'Check processing_logs table for detailed results'
      );
    END IF;

    RETURN jsonb_build_object(
      'success', false,
      'error', 'Failed to initiate email batch processing'
    );

  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Exception: ' || SQLERRM
    );
  END;
END;
$$;
