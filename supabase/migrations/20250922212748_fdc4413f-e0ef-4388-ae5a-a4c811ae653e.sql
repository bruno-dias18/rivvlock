-- Add postal_code and city columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN postal_code text,
ADD COLUMN city text;