-- Fix security issues - check what needs to be done

-- PROBLEM 1: Quotes access (check if already fixed)
DO $$ 
BEGIN
  -- Drop old permissive policy if it exists
  DROP POLICY IF EXISTS "quotes_select_seller_client_or_open" ON public.quotes;
  
  -- Create restrictive policy only if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'quotes' 
    AND policyname = 'quotes_select_participants_only'
  ) THEN
    CREATE POLICY "quotes_select_participants_only" ON public.quotes
    FOR SELECT
    USING (
      (seller_id = auth.uid()) 
      OR (client_user_id = auth.uid() AND client_user_id IS NOT NULL)
      OR is_admin(auth.uid())
    );
  END IF;
END $$;

-- PROBLEM 2: Feature flags (check if already fixed)
DO $$ 
BEGIN
  -- Drop old public policy if it exists
  DROP POLICY IF EXISTS "Anyone can view feature flags" ON public.feature_flags;
  
  -- Create restrictive policy only if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'feature_flags' 
    AND policyname = 'Authenticated users can view feature flags'
  ) THEN
    CREATE POLICY "Authenticated users can view feature flags" ON public.feature_flags
    FOR SELECT
    USING (auth.uid() IS NOT NULL);
  END IF;
END $$;