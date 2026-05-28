
-- Fix: Add input validation to handle_new_user trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_display_name TEXT;
BEGIN
  v_display_name := TRIM(COALESCE(NEW.raw_user_meta_data->>'display_name', ''));
  -- Limit length to prevent abuse
  IF LENGTH(v_display_name) > 100 THEN
    v_display_name := LEFT(v_display_name, 100);
  END IF;
  
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, v_display_name);
  RETURN NEW;
END;
$$;
