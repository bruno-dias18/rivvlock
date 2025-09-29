-- Create invoice sequences table to track unique numbering per seller
CREATE TABLE public.invoice_sequences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id UUID NOT NULL,
  current_sequence INTEGER NOT NULL DEFAULT 0,
  year INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(seller_id, year)
);

-- Create invoices table to store generated invoice records
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number TEXT NOT NULL UNIQUE,
  transaction_id UUID NOT NULL,
  seller_id UUID NOT NULL,
  buyer_id UUID,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  pdf_metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.invoice_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- RLS policies for invoice_sequences
CREATE POLICY "Users can view their own invoice sequences" 
ON public.invoice_sequences 
FOR SELECT 
USING (auth.uid() = seller_id);

CREATE POLICY "Users can update their own invoice sequences" 
ON public.invoice_sequences 
FOR UPDATE 
USING (auth.uid() = seller_id);

CREATE POLICY "Users can insert their own invoice sequences" 
ON public.invoice_sequences 
FOR INSERT 
WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Admins can manage all invoice sequences" 
ON public.invoice_sequences 
FOR ALL 
USING (is_admin(auth.uid()));

-- RLS policies for invoices
CREATE POLICY "Users can view invoices they are involved in" 
ON public.invoices 
FOR SELECT 
USING (auth.uid() = seller_id OR auth.uid() = buyer_id);

CREATE POLICY "Users can create invoices for their transactions" 
ON public.invoices 
FOR INSERT 
WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Admins can view all invoices" 
ON public.invoices 
FOR SELECT 
USING (is_admin(auth.uid()));

-- Add triggers for updated_at
CREATE TRIGGER update_invoice_sequences_updated_at
BEFORE UPDATE ON public.invoice_sequences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add indexes for performance
CREATE INDEX idx_invoice_sequences_seller_year ON public.invoice_sequences(seller_id, year);
CREATE INDEX idx_invoices_seller ON public.invoices(seller_id);
CREATE INDEX idx_invoices_transaction ON public.invoices(transaction_id);