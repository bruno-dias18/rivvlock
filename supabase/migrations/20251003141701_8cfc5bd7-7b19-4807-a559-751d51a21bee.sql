-- Add explicit anonymous blocking policies for invoices and transactions
-- These are additional security layers that don't change app functionality

-- 1) Block all anonymous access to invoices table
CREATE POLICY "Block all anonymous access to invoices"
ON public.invoices
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- 2) Block all anonymous access to transactions table
CREATE POLICY "Block all anonymous access to transactions"
ON public.transactions
FOR ALL
TO anon
USING (false)
WITH CHECK (false);