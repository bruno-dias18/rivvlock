-- Create admin role for bruno-dias@outlook.com
INSERT INTO public.admin_roles (user_id, email, role)
VALUES ('0a3bc1b2-0d00-412e-a6da-5554abc42aaf', 'bruno-dias@outlook.com', 'admin')
ON CONFLICT (user_id, email) DO NOTHING;

-- Create a basic profile for the admin user  
INSERT INTO public.profiles (
  user_id, 
  user_type, 
  country, 
  verified,
  registration_complete,
  acceptance_terms
) VALUES (
  '0a3bc1b2-0d00-412e-a6da-5554abc42aaf',
  'business',
  'FR', 
  true,
  true,
  true
) ON CONFLICT (user_id) DO NOTHING;