-- Security lockdown: restrict public RLS and revoke broad EXECUTE grants.
-- Before this migration the anon role could read/update any subscriber row,
-- trigger expensive cron functions, and write commitfest data. After this
-- migration all subscription writes must go through the new edge functions
-- (subscribe / request-unsubscribe / confirm-unsubscribe) and all cron and
-- commitfest writers are reachable only via service_role.

-- ============================================================================
-- subscribers: drop all public policies, allow only service_role
-- ============================================================================

DROP POLICY IF EXISTS "Allow public subscription"                 ON public.subscribers;
DROP POLICY IF EXISTS "Allow public read active subscribers"      ON public.subscribers;
DROP POLICY IF EXISTS "Allow public read confirmed subscribers"   ON public.subscribers;
DROP POLICY IF EXISTS "Allow public read own subscription"        ON public.subscribers;
DROP POLICY IF EXISTS "Allow public unsubscribe"                  ON public.subscribers;
DROP POLICY IF EXISTS "Allow public update subscription"          ON public.subscribers;
DROP POLICY IF EXISTS "Allow public update subscription status"   ON public.subscribers;
DROP POLICY IF EXISTS "Allow public insert subscriptions"         ON public.subscribers;
DROP POLICY IF EXISTS "Allow public access to stats"              ON public.subscribers;
DROP POLICY IF EXISTS "Allow service role full access"            ON public.subscribers;

ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.subscribers
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

REVOKE ALL ON public.subscribers FROM anon, authenticated, PUBLIC;

-- ============================================================================
-- app_secrets: enforce RLS, service_role only
-- ============================================================================

ALTER TABLE public.app_secrets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role only" ON public.app_secrets;
CREATE POLICY "Service role only" ON public.app_secrets
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

REVOKE ALL ON public.app_secrets FROM anon, authenticated, PUBLIC;

-- get_app_secret / set_app_secret are SECURITY INVOKER, but make the intent
-- explicit so future migrations don't accidentally re-grant them.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'get_app_secret') THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.get_app_secret(text) FROM anon, authenticated, PUBLIC';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'set_app_secret') THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.set_app_secret(text, text, text) FROM anon, authenticated, PUBLIC';
  END IF;
END
$$;

-- ============================================================================
-- Cron trigger functions: only service_role / postgres may call
-- ============================================================================

DO $$
DECLARE
  fn_name text;
BEGIN
  FOREACH fn_name IN ARRAY ARRAY[
    'public.trigger_fetch_mail_threads()',
    'public.trigger_fetch_thread_content()',
    'public.trigger_generate_summary_only()',
    'public.trigger_generate_summary_for_date(date)',
    'public.send_latest_summary_to_users(text[])',
    'public.trigger_sync_commitfest_data()'
  ]
  LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, authenticated, PUBLIC', fn_name);
    EXCEPTION WHEN undefined_function THEN
      -- function not present in this environment; skip
      NULL;
    END;
  END LOOP;
END
$$;

-- ============================================================================
-- commitfest schema: revoke writer grants from anon/authenticated.
-- We blanket-revoke EXECUTE on all functions then re-grant the read-only
-- helpers that the public site needs (none today; the read paths use
-- public.get_commitfest_tags_* RPCs which live in the public schema).
-- SELECT on commitfest.tags / commitfest.patch_tags is unchanged.
-- ============================================================================

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA commitfest FROM anon, authenticated, PUBLIC;

-- Default privilege so future commitfest functions also start locked down.
ALTER DEFAULT PRIVILEGES IN SCHEMA commitfest
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated, PUBLIC;

-- Read-only RPCs used by the public site stay accessible:
--   public.get_public_stats()
--   public.get_all_commitfest_tags()
--   public.get_commitfest_tags_for_subject(text)
--   public.get_commitfest_tags_with_colors_for_subject(text)
-- These were granted in earlier migrations and are unaffected.
