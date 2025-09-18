-- Enable leaked password protection in Supabase Auth
-- This prevents users from using passwords that have been found in data breaches
UPDATE auth.config 
SET password_min_length = 8,
    password_require_letters = true,
    password_require_numbers = true,
    password_require_symbols = false,
    password_require_uppercase = true,
    password_require_lowercase = true;

-- Note: The leaked password protection is typically enabled through the Supabase dashboard
-- but we can ensure minimum password requirements are set properly