-- 1. Add server-controlled force_password_reset column
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS force_password_reset BOOLEAN NOT NULL DEFAULT false;

-- 2. Prevent users from updating force_password_reset via their own UPDATE policy.
-- Replace the broad "Users can update own profile" with a column-aware one.
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND force_password_reset = (
    SELECT p.force_password_reset FROM public.profiles p WHERE p.user_id = auth.uid()
  )
);

-- Same protection on INSERT: users cannot self-set the flag to true
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = user_id AND force_password_reset = false);

-- 3. Update handle_new_user to honor must_change_password from admin-created users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_display_name TEXT;
  v_force_reset BOOLEAN;
BEGIN
  v_display_name := TRIM(COALESCE(NEW.raw_user_meta_data->>'display_name', ''));
  IF LENGTH(v_display_name) > 100 THEN
    v_display_name := LEFT(v_display_name, 100);
  END IF;

  v_force_reset := COALESCE((NEW.raw_user_meta_data->>'must_change_password')::boolean, false);

  INSERT INTO public.profiles (user_id, display_name, force_password_reset)
  VALUES (NEW.id, v_display_name, v_force_reset);
  RETURN NEW;
END;
$function$;

-- Ensure the trigger exists on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Clear force_password_reset automatically when the user's password actually changes
CREATE OR REPLACE FUNCTION public.clear_force_password_reset()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.encrypted_password IS DISTINCT FROM OLD.encrypted_password THEN
    UPDATE public.profiles
       SET force_password_reset = false,
           updated_at = now()
     WHERE user_id = NEW.id
       AND force_password_reset = true;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_auth_user_password_change ON auth.users;
CREATE TRIGGER on_auth_user_password_change
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.clear_force_password_reset();

-- 5. Add explicit deny-by-default RESTRICTIVE policies on user_roles.
-- These ensure that even if some future PERMISSIVE policy is added by mistake,
-- non-admins still cannot insert/update/delete roles, and admins cannot
-- modify their own role (preventing self-promotion or self-demotion bypasses).

CREATE POLICY "Restrict role inserts to admins only"
ON public.user_roles
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND user_id <> auth.uid()
);

CREATE POLICY "Restrict role updates to admins only"
ON public.user_roles
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) AND user_id <> auth.uid())
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) AND user_id <> auth.uid());

CREATE POLICY "Restrict role deletes to admins only"
ON public.user_roles
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) AND user_id <> auth.uid());