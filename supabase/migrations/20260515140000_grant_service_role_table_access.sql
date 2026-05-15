-- After lockdown REVOKE, service_role needs explicit table grants (RLS policies
-- alone are not enough). Without these, edge functions return:
--   permission denied for table subscribers

GRANT ALL ON TABLE public.subscribers TO service_role;
GRANT ALL ON TABLE public.app_secrets TO service_role;
GRANT ALL ON TABLE public.api_rate_limits TO service_role;
GRANT ALL ON TABLE public.mail_threads TO service_role;
GRANT ALL ON TABLE public.mail_thread_contents TO service_role;
GRANT ALL ON TABLE public.weekly_discussions TO service_role;

-- get_public_stats() runs as anon but must count subscribers; use DEFINER so
-- the homepage stats RPC still works without reopening direct table access.
CREATE OR REPLACE FUNCTION public.get_public_stats()
RETURNS TABLE (
  total_subscribers BIGINT,
  total_summaries BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*)::BIGINT FROM subscribers
     WHERE confirmation_status = 'confirmed' AND is_active = true) AS total_subscribers,
    (SELECT COUNT(*)::BIGINT FROM weekly_summaries) AS total_summaries;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_stats() TO anon, authenticated, service_role;
