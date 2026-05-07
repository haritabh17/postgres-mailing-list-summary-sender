// Standard CORS headers for edge functions. Allow-Origin is wildcard because
// our edge functions are publicly invokable; the access control happens via
// auth (see _shared/auth.ts) or token validation, not the browser CORS layer.
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
