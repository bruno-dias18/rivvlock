-- Add service_end_date and proposed_service_end_date columns to transactions table
-- These columns are optional and will only be used for multi-day services

ALTER TABLE public.transactions
ADD COLUMN service_end_date timestamp with time zone,
ADD COLUMN proposed_service_end_date timestamp with time zone;