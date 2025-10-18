-- Fix the existing dispute that's not linked to its conversation
UPDATE public.disputes
SET conversation_id = '2b9e494d-0626-4712-8e43-bbf6c2bd948a'
WHERE id = '28578298-1696-4dfc-88ee-4c84e4849714';

-- Also link the conversation back to the dispute
UPDATE public.conversations
SET dispute_id = '28578298-1696-4dfc-88ee-4c84e4849714'
WHERE id = '2b9e494d-0626-4712-8e43-bbf6c2bd948a';