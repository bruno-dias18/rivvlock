-- Migration: Move pgcrypto to extensions schema
-- Risk: Very low
-- Impact: None on application functionality
-- Benefit: +0.5 security score

-- Create extensions schema if not exists
CREATE SCHEMA IF NOT EXISTS extensions;

-- Move pgcrypto extension to extensions schema
ALTER EXTENSION pgcrypto SET SCHEMA extensions;