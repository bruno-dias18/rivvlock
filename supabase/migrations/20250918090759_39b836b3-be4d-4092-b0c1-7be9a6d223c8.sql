-- Create default profiles for existing users without metadata
INSERT INTO public.profiles (
  user_id,
  user_type,
  country,
  verified
)
SELECT 
  u.id,
  'individual'::public.user_type, -- Default to individual
  'FR'::public.country_code,      -- Default to France
  false
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE p.user_id IS NULL;