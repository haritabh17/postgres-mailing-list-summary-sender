-- Schedule weekly summary email send every Friday at 10:00 UTC.
-- Summary generation runs separately at 05:00 UTC (generate-weekly-summary-friday),
-- leaving a 5-hour window to review or regenerate before emails go out.

CREATE OR REPLACE FUNCTION public.trigger_weekly_summary_send()
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
  subscriber_emails TEXT[];
  send_result jsonb;
  subscriber_count INTEGER;
BEGIN
  SELECT ARRAY(
    SELECT email
    FROM subscribers
    WHERE is_active = true
      AND confirmation_status = 'confirmed'
    ORDER BY email
  ) INTO subscriber_emails;

  subscriber_count := COALESCE(array_length(subscriber_emails, 1), 0);

  INSERT INTO processing_logs (process_type, status, message, metadata, started_at)
  VALUES (
    'cron_weekly_summary_send',
    'in_progress',
    'Starting weekly summary email send',
    jsonb_build_object(
      'triggered_at', NOW(),
      'task_type', 'weekly_summary_send',
      'schedule', 'friday_10am_utc',
      'subscriber_count', subscriber_count
    ),
    NOW()
  );

  INSERT INTO cron_schedule (task_name, schedule_expression, last_run_at, next_run_at)
  VALUES (
    'weekly-summary-send',
    '0 10 * * 5',
    NOW(),
    DATE_TRUNC('week', NOW() + INTERVAL '1 week') + INTERVAL '5 days' + INTERVAL '10 hours'
  )
  ON CONFLICT (task_name) DO UPDATE SET
    last_run_at = NOW(),
    next_run_at = DATE_TRUNC('week', NOW() + INTERVAL '1 week') + INTERVAL '5 days' + INTERVAL '10 hours',
    updated_at = NOW(),
    schedule_expression = '0 10 * * 5'
  WHERE cron_schedule.task_name = 'weekly-summary-send';

  IF subscriber_count = 0 THEN
    INSERT INTO processing_logs (process_type, status, message, metadata, completed_at)
    VALUES (
      'cron_weekly_summary_send',
      'error',
      'No active confirmed subscribers to send to',
      jsonb_build_object('subscriber_count', 0),
      NOW()
    );
    RETURN;
  END IF;

  BEGIN
    send_result := send_latest_summary_to_users(subscriber_emails);

    IF (send_result->>'success')::boolean THEN
      INSERT INTO processing_logs (process_type, status, message, metadata, completed_at)
      VALUES (
        'cron_weekly_summary_send',
        'success',
        'Email batch processing initiated for weekly summary send',
        jsonb_build_object(
          'subscriber_count', subscriber_count,
          'request_id', send_result->'request_id',
          'send_result', send_result
        ),
        NOW()
      );
    ELSE
      INSERT INTO processing_logs (process_type, status, message, metadata, completed_at)
      VALUES (
        'cron_weekly_summary_send',
        'error',
        'Failed to initiate weekly summary send: ' || COALESCE(send_result->>'error', 'unknown error'),
        jsonb_build_object(
          'subscriber_count', subscriber_count,
          'send_result', send_result
        ),
        NOW()
      );
    END IF;

  EXCEPTION WHEN OTHERS THEN
    INSERT INTO processing_logs (process_type, status, message, metadata, completed_at)
    VALUES (
      'cron_weekly_summary_send',
      'error',
      'Exception during weekly summary send: ' || SQLERRM,
      jsonb_build_object(
        'subscriber_count', subscriber_count,
        'error_detail', SQLSTATE
      ),
      NOW()
    );
  END;
END;
$function$;

COMMENT ON FUNCTION public.trigger_weekly_summary_send() IS
  'Sends the latest weekly summary to all active confirmed subscribers. '
  'Scheduled via pg_cron every Friday at 10:00 UTC, five hours after summary generation at 05:00 UTC.';

SELECT cron.schedule(
  'weekly-summary-send',
  '0 10 * * 5',
  'SELECT trigger_weekly_summary_send();'
);

CREATE OR REPLACE FUNCTION public.test_weekly_summary_send_cron()
RETURNS text
LANGUAGE plpgsql
AS $function$
DECLARE
  result text;
BEGIN
  PERFORM trigger_weekly_summary_send();

  SELECT message INTO result
  FROM processing_logs
  WHERE process_type = 'cron_weekly_summary_send'
  ORDER BY started_at DESC
  LIMIT 1;

  RETURN 'Weekly send cron test executed. Latest result: ' || COALESCE(result, 'No logs found');
END;
$function$;

COMMENT ON FUNCTION public.test_weekly_summary_send_cron() IS
  'Manually triggers the weekly summary email send (same as the Friday 10:00 UTC cron job).';

-- Match lockdown pattern: cron triggers are not callable via the public API.
REVOKE EXECUTE ON FUNCTION public.trigger_weekly_summary_send() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.test_weekly_summary_send_cron() FROM anon, authenticated, PUBLIC;
