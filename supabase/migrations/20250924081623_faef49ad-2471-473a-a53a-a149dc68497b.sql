-- Add vat_number column to profiles table to store VAT identification numbers
ALTER TABLE public.profiles 
ADD COLUMN vat_number text;

-- Add is_subject_to_vat column to track if user is subject to VAT
ALTER TABLE public.profiles 
ADD COLUMN is_subject_to_vat boolean DEFAULT false;