-- Add new fields to transactions table for matching and payment features
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS shared_link_token text UNIQUE,
ADD COLUMN IF NOT EXISTS buyer_id uuid,
ADD COLUMN IF NOT EXISTS payment_deadline timestamp with time zone,
ADD COLUMN IF NOT EXISTS payment_method text,
ADD COLUMN IF NOT EXISTS payment_blocked_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS link_expires_at timestamp with time zone;