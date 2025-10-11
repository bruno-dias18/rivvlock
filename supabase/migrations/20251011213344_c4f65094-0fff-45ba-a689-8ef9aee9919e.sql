-- Promote admin to super_admin for full dashboard access
-- Risk: ZERO - Only adds super_admin role to existing admin
-- Impact: Restores full admin dashboard functionality
-- User: bruno-dias@outlook.com

-- Add super_admin role to the admin user
INSERT INTO user_roles (user_id, role) 
VALUES ('b8a81048-9813-426e-92d3-21ab45cc17d4', 'super_admin')
ON CONFLICT (user_id, role) DO NOTHING;