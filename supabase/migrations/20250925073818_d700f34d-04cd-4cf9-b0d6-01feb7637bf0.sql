-- Fix existing transactions with incorrect payment_deadline
-- Set payment_deadline to 24 hours before service_date for all pending transactions

UPDATE transactions 
SET payment_deadline = service_date - INTERVAL '24 hours',
    updated_at = now()
WHERE status = 'pending'
  AND service_date IS NOT NULL
  AND buyer_id IS NOT NULL;