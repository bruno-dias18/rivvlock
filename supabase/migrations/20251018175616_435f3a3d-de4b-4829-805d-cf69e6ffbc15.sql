-- Phase 5 - Step 2C: Data Migration (Fixed)
-- Migrate existing disputes to unified conversation architecture

-- Step 1: Create conversations for disputes that don't have one yet
INSERT INTO public.conversations (
  seller_id,
  buyer_id,
  dispute_id,
  conversation_type,
  status,
  created_at,
  updated_at
)
SELECT 
  t.user_id as seller_id,
  t.buyer_id,
  d.id as dispute_id,
  'dispute'::conversation_type,
  'active' as status,
  d.created_at,
  d.updated_at
FROM public.disputes d
JOIN public.transactions t ON t.id = d.transaction_id
WHERE d.conversation_id IS NULL
  AND t.user_id IS NOT NULL
  AND t.buyer_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Step 2: Link disputes to their newly created conversations
UPDATE public.disputes d
SET conversation_id = c.id,
    updated_at = now()
FROM public.conversations c
WHERE c.dispute_id = d.id
  AND d.conversation_id IS NULL;

-- Step 3: For escalated disputes, create admin conversations
DO $$
DECLARE
  admin_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO admin_count FROM public.user_roles WHERE role = 'admin';
  
  IF admin_count > 0 THEN
    -- Create seller ↔ admin conversations
    INSERT INTO public.conversations (
      seller_id,
      buyer_id,
      dispute_id,
      admin_id,
      conversation_type,
      status,
      created_at,
      updated_at
    )
    SELECT 
      (SELECT user_id FROM public.user_roles WHERE role = 'admin' LIMIT 1),
      t.user_id,
      d.id,
      (SELECT user_id FROM public.user_roles WHERE role = 'admin' LIMIT 1),
      'admin_seller_dispute'::conversation_type,
      'active',
      COALESCE(d.escalated_at, d.created_at),
      d.updated_at
    FROM public.disputes d
    JOIN public.transactions t ON t.id = d.transaction_id
    WHERE d.escalated_at IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.dispute_id = d.id
        AND c.conversation_type = 'admin_seller_dispute'
      )
    ON CONFLICT DO NOTHING;

    -- Create buyer ↔ admin conversations
    INSERT INTO public.conversations (
      seller_id,
      buyer_id,
      dispute_id,
      admin_id,
      conversation_type,
      status,
      created_at,
      updated_at
    )
    SELECT 
      (SELECT user_id FROM public.user_roles WHERE role = 'admin' LIMIT 1),
      t.buyer_id,
      d.id,
      (SELECT user_id FROM public.user_roles WHERE role = 'admin' LIMIT 1),
      'admin_buyer_dispute'::conversation_type,
      'active',
      COALESCE(d.escalated_at, d.created_at),
      d.updated_at
    FROM public.disputes d
    JOIN public.transactions t ON t.id = d.transaction_id
    WHERE d.escalated_at IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.dispute_id = d.id
        AND c.conversation_type = 'admin_buyer_dispute'
      )
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Step 4: Create validation view
CREATE OR REPLACE VIEW public.dispute_migration_status AS
SELECT 'Total Disputes' as metric, COUNT(*)::text as count FROM public.disputes
UNION ALL
SELECT 'Disputes with Conversations', COUNT(*)::text FROM public.disputes WHERE conversation_id IS NOT NULL
UNION ALL
SELECT 'Disputes without Conversations', COUNT(*)::text FROM public.disputes WHERE conversation_id IS NULL
UNION ALL
SELECT 'Active Disputes', COUNT(*)::text FROM public.disputes WHERE status IN ('open', 'responded', 'negotiating', 'escalated')
UNION ALL
SELECT 'Escalated Disputes', COUNT(*)::text FROM public.disputes WHERE escalated_at IS NOT NULL
UNION ALL
SELECT 'Admin Seller Conversations', COUNT(*)::text FROM public.conversations WHERE conversation_type = 'admin_seller_dispute'
UNION ALL
SELECT 'Admin Buyer Conversations', COUNT(*)::text FROM public.conversations WHERE conversation_type = 'admin_buyer_dispute';

GRANT SELECT ON public.dispute_migration_status TO authenticated;