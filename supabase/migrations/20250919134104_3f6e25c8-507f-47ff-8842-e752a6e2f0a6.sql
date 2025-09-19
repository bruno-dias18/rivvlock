-- Fix policy: INSERT policies require only WITH CHECK
DROP POLICY IF EXISTS "Allow auth trigger to create profiles" ON public.profiles;
CREATE POLICY "Allow auth trigger to create profiles"
ON public.profiles
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  OR (
    auth.uid() IS NULL
    AND EXISTS (
      SELECT 1 FROM auth.users u WHERE u.id = user_id
    )
  )
);