-- Add missing columns to transactions table for validation and funds management
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS seller_validated BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS buyer_validated BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS funds_released BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS validation_deadline TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS payment_blocked_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS funds_released_at TIMESTAMP WITH TIME ZONE;