-- Subscription DB writes run as SECURITY DEFINER so they work even when table
-- grants for service_role were accidentally revoked. Edge functions call this
-- RPC with the service-role Supabase client.

CREATE OR REPLACE FUNCTION public.initiate_subscription(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_row subscribers%ROWTYPE;
  v_token text;
  v_expires timestamptz;
BEGIN
  v_email := lower(trim(p_email));
  IF v_email IS NULL OR v_email = '' OR length(v_email) > 254 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_email');
  END IF;

  SELECT * INTO v_row FROM subscribers WHERE email = v_email;

  IF FOUND AND v_row.confirmation_status = 'confirmed' AND v_row.is_active THEN
    RETURN jsonb_build_object('ok', true, 'action', 'noop_confirmed');
  END IF;

  IF FOUND
     AND v_row.confirmation_status = 'pending_confirmation'
     AND v_row.confirmation_expires_at IS NOT NULL
     AND v_row.confirmation_expires_at > now() THEN
    RETURN jsonb_build_object('ok', true, 'action', 'noop_pending');
  END IF;

  v_token := gen_random_uuid()::text;
  v_expires := now() + interval '5 minutes';

  IF FOUND THEN
    UPDATE subscribers
    SET confirmation_token = v_token,
        confirmation_expires_at = v_expires,
        confirmation_status = 'pending_confirmation',
        is_active = false,
        subscribed_at = now(),
        updated_at = now()
    WHERE id = v_row.id;
  ELSE
    BEGIN
      INSERT INTO subscribers (
        email,
        confirmation_token,
        confirmation_expires_at,
        confirmation_status,
        is_active
      ) VALUES (
        v_email,
        v_token,
        v_expires,
        'pending_confirmation',
        false
      );
    EXCEPTION WHEN unique_violation THEN
      RETURN jsonb_build_object('ok', true, 'action', 'noop_race');
    END;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'action', 'send_confirmation',
    'confirmation_token', v_token
  );
END;
$$;

REVOKE ALL ON FUNCTION public.initiate_subscription(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.initiate_subscription(text) TO service_role;

-- Belt-and-suspenders table grants (idempotent if already applied)
GRANT ALL ON TABLE public.subscribers TO service_role;
GRANT ALL ON TABLE public.api_rate_limits TO service_role;
