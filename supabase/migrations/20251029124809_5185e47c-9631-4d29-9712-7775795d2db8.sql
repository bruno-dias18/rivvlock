-- Phase 1: Bank Reconciliation System - Database Schema
-- Creates tables for storing bank statements and reconciliations

-- Table for storing imported bank statements (camt.053/054 XML files)
CREATE TABLE public.bank_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  statement_date DATE NOT NULL,
  account_iban TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CHF',
  opening_balance NUMERIC(15,2),
  closing_balance NUMERIC(15,2),
  total_credits NUMERIC(15,2),
  total_debits NUMERIC(15,2),
  raw_xml TEXT,
  parsed_entries JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  reconciliation_status TEXT NOT NULL DEFAULT 'not_started',
  reconciled_count INTEGER DEFAULT 0,
  unreconciled_count INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_bank_statements_date ON public.bank_statements(statement_date);
CREATE INDEX idx_bank_statements_status ON public.bank_statements(status);
CREATE INDEX idx_bank_statements_reconciliation_status ON public.bank_statements(reconciliation_status);
CREATE INDEX idx_bank_statements_uploaded_by ON public.bank_statements(uploaded_by);

-- RLS policies for bank_statements
ALTER TABLE public.bank_statements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view bank statements" 
  ON public.bank_statements FOR SELECT 
  USING (is_admin(auth.uid()));

CREATE POLICY "Only admins can insert bank statements" 
  ON public.bank_statements FOR INSERT 
  WITH CHECK (is_admin(auth.uid()) AND uploaded_by = auth.uid());

CREATE POLICY "Only admins can update bank statements" 
  ON public.bank_statements FOR UPDATE 
  USING (is_admin(auth.uid()));

CREATE POLICY "Block anonymous access to bank statements"
  ON public.bank_statements FOR ALL
  USING (false)
  WITH CHECK (false);

-- Table for linking bank payments to RivvLock transactions
CREATE TABLE public.bank_reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_statement_id UUID NOT NULL REFERENCES public.bank_statements(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  
  -- Bank payment data
  bank_reference TEXT NOT NULL,
  bank_amount NUMERIC(15,2) NOT NULL,
  bank_currency TEXT NOT NULL,
  bank_debtor_name TEXT,
  bank_debtor_iban TEXT,
  value_date DATE NOT NULL,
  booking_date DATE,
  bank_transaction_id TEXT,
  
  -- Reconciliation status
  reconciliation_status TEXT NOT NULL DEFAULT 'pending',
  match_confidence INTEGER DEFAULT 0,
  matched_at TIMESTAMPTZ,
  matched_by UUID,
  
  -- Matching details
  matching_method TEXT,
  amount_difference NUMERIC(15,2),
  notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_bank_reconciliations_statement ON public.bank_reconciliations(bank_statement_id);
CREATE INDEX idx_bank_reconciliations_transaction ON public.bank_reconciliations(transaction_id);
CREATE INDEX idx_bank_reconciliations_reference ON public.bank_reconciliations(bank_reference);
CREATE INDEX idx_bank_reconciliations_status ON public.bank_reconciliations(reconciliation_status);
CREATE UNIQUE INDEX idx_bank_reconciliations_unique_transaction 
  ON public.bank_reconciliations(transaction_id) 
  WHERE transaction_id IS NOT NULL AND reconciliation_status = 'matched';

-- RLS policies for bank_reconciliations
ALTER TABLE public.bank_reconciliations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view reconciliations" 
  ON public.bank_reconciliations FOR SELECT 
  USING (is_admin(auth.uid()));

CREATE POLICY "Only admins can insert reconciliations" 
  ON public.bank_reconciliations FOR INSERT 
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Only admins can update reconciliations" 
  ON public.bank_reconciliations FOR UPDATE 
  USING (is_admin(auth.uid()));

CREATE POLICY "Block anonymous access to reconciliations"
  ON public.bank_reconciliations FOR ALL
  USING (false)
  WITH CHECK (false);

-- Add optional tracking columns to transactions table
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS bank_reconciled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS bank_reconciled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS bank_reconciled_by UUID;

-- Index for finding unreconciled paid transactions
CREATE INDEX IF NOT EXISTS idx_transactions_bank_reconciled 
  ON public.transactions(bank_reconciled) 
  WHERE bank_reconciled = FALSE AND status = 'paid';

-- Trigger to update updated_at on bank_statements
CREATE OR REPLACE FUNCTION public.update_bank_statements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_bank_statements_updated_at
  BEFORE UPDATE ON public.bank_statements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_bank_statements_updated_at();

-- Trigger to update updated_at on bank_reconciliations
CREATE OR REPLACE FUNCTION public.update_bank_reconciliations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_bank_reconciliations_updated_at
  BEFORE UPDATE ON public.bank_reconciliations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_bank_reconciliations_updated_at();