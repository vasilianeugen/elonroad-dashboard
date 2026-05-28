-- Revoke EXECUTE from PUBLIC, anon, and authenticated on SECURITY DEFINER functions.
-- RLS policies and triggers continue to work because they execute in the database,
-- not via the PostgREST API role grants.

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.clear_force_password_reset() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;