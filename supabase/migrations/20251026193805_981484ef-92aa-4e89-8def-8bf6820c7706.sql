-- ================================
-- KYC/AML COMPLIANCE TABLES
-- ================================

-- Table: kyc_status (statut de vérification vendeur)
CREATE TABLE IF NOT EXISTS public.kyc_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'approved', 'rejected', 'additional_info_required')),
  rejection_reason TEXT,
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Table: kyc_documents (stockage documents d'identité)
CREATE TABLE IF NOT EXISTS public.kyc_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('id_front', 'id_back', 'bank_statement', 'business_registry', 'proof_of_address', 'other')),
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  verified BOOLEAN DEFAULT false,
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table: aml_checks (checks anti-blanchiment - pour phase 2)
CREATE TABLE IF NOT EXISTS public.aml_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  check_type TEXT NOT NULL CHECK (check_type IN ('manual', 'automated', 'periodic')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'passed', 'failed', 'flagged')),
  risk_score INTEGER CHECK (risk_score BETWEEN 0 AND 100),
  flags JSONB DEFAULT '[]'::jsonb,
  checked_by UUID REFERENCES auth.users(id),
  provider TEXT,
  provider_response JSONB,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ================================
-- ADYEN ACCOUNTING TABLES
-- ================================

-- Table: adyen_payout_accounts (comptes bancaires vendeurs)
CREATE TABLE IF NOT EXISTS public.adyen_payout_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  iban TEXT NOT NULL,
  bic TEXT,
  account_holder_name TEXT NOT NULL,
  bank_name TEXT,
  country TEXT NOT NULL,
  verified BOOLEAN DEFAULT false,
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMP WITH TIME ZONE,
  is_default BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, iban)
);

-- Table: adyen_payouts (traçabilité des paiements)
CREATE TABLE IF NOT EXISTS public.adyen_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Montants (en centimes)
  gross_amount INTEGER NOT NULL,
  platform_commission INTEGER NOT NULL,
  seller_amount INTEGER NOT NULL,
  estimated_processor_fees INTEGER NOT NULL,
  net_platform_revenue INTEGER NOT NULL,
  currency TEXT NOT NULL,
  
  -- Destination bancaire
  iban_destination TEXT NOT NULL,
  bic TEXT,
  account_holder_name TEXT NOT NULL,
  
  -- Statut et traçabilité
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'completed', 'failed')),
  batch_reference TEXT,
  bank_reference TEXT,
  admin_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sent_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata pour audit
  metadata JSONB DEFAULT '{}'::jsonb,
  
  UNIQUE(transaction_id)
);

-- ================================
-- INDEXES FOR PERFORMANCE
-- ================================

CREATE INDEX IF NOT EXISTS idx_kyc_status_user ON public.kyc_status(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_status_status ON public.kyc_status(status);
CREATE INDEX IF NOT EXISTS idx_kyc_documents_user ON public.kyc_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_documents_verified ON public.kyc_documents(verified);
CREATE INDEX IF NOT EXISTS idx_aml_checks_user ON public.aml_checks(user_id);
CREATE INDEX IF NOT EXISTS idx_aml_checks_status ON public.aml_checks(status);
CREATE INDEX IF NOT EXISTS idx_adyen_payout_accounts_user ON public.adyen_payout_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_adyen_payouts_seller ON public.adyen_payouts(seller_id);
CREATE INDEX IF NOT EXISTS idx_adyen_payouts_status ON public.adyen_payouts(status);
CREATE INDEX IF NOT EXISTS idx_adyen_payouts_transaction ON public.adyen_payouts(transaction_id);

-- ================================
-- ROW LEVEL SECURITY (RLS)
-- ================================

ALTER TABLE public.kyc_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aml_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adyen_payout_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adyen_payouts ENABLE ROW LEVEL SECURITY;

-- KYC Status policies
CREATE POLICY "Users can view their own KYC status"
  ON public.kyc_status FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all KYC statuses"
  ON public.kyc_status FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can update KYC statuses"
  ON public.kyc_status FOR UPDATE
  USING (is_admin(auth.uid()));

CREATE POLICY "System can insert KYC status"
  ON public.kyc_status FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- KYC Documents policies
CREATE POLICY "Users can view their own documents"
  ON public.kyc_documents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all documents"
  ON public.kyc_documents FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY "Users can upload their own documents"
  ON public.kyc_documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update documents"
  ON public.kyc_documents FOR UPDATE
  USING (is_admin(auth.uid()));

-- AML Checks policies
CREATE POLICY "Users can view their own AML checks"
  ON public.aml_checks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all AML checks"
  ON public.aml_checks FOR ALL
  USING (is_admin(auth.uid()));

-- Adyen Payout Accounts policies
CREATE POLICY "Users can view their own payout accounts"
  ON public.adyen_payout_accounts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all payout accounts"
  ON public.adyen_payout_accounts FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY "Users can manage their own payout accounts"
  ON public.adyen_payout_accounts FOR ALL
  USING (auth.uid() = user_id);

-- Adyen Payouts policies
CREATE POLICY "Sellers can view their own payouts"
  ON public.adyen_payouts FOR SELECT
  USING (auth.uid() = seller_id);

CREATE POLICY "Admins can manage all payouts"
  ON public.adyen_payouts FOR ALL
  USING (is_admin(auth.uid()));

-- ================================
-- TRIGGERS
-- ================================

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_kyc_status_updated_at
  BEFORE UPDATE ON public.kyc_status
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kyc_documents_updated_at
  BEFORE UPDATE ON public.kyc_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_aml_checks_updated_at
  BEFORE UPDATE ON public.aml_checks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_adyen_payout_accounts_updated_at
  BEFORE UPDATE ON public.adyen_payout_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger pour créer automatiquement kyc_status à la création d'un profile
CREATE OR REPLACE FUNCTION create_kyc_status_on_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.kyc_status (user_id, status)
  VALUES (NEW.user_id, 'pending')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_profile_created_kyc
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION create_kyc_status_on_profile();

-- ================================
-- HELPER FUNCTIONS
-- ================================

-- Fonction pour vérifier si un vendeur peut créer une transaction
CREATE OR REPLACE FUNCTION can_create_transaction(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_kyc_status TEXT;
  v_total_volume NUMERIC;
BEGIN
  -- Récupérer le statut KYC
  SELECT status INTO v_kyc_status
  FROM public.kyc_status
  WHERE user_id = p_user_id;
  
  -- Si pas de KYC vérifié, limiter à CHF 1'000
  IF v_kyc_status IS NULL OR v_kyc_status != 'approved' THEN
    SELECT COALESCE(SUM(price), 0) INTO v_total_volume
    FROM public.transactions
    WHERE user_id = p_user_id
      AND status != 'cancelled'
      AND created_at > (now() - INTERVAL '1 year');
    
    RETURN v_total_volume < 1000;
  END IF;
  
  -- Si KYC vérifié, pas de limite
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour calculer le solde comptable Adyen
CREATE OR REPLACE FUNCTION get_adyen_accounting_summary()
RETURNS TABLE(
  total_captured NUMERIC,
  total_owed_to_sellers NUMERIC,
  total_platform_commission NUMERIC,
  total_estimated_fees NUMERIC,
  total_net_revenue NUMERIC,
  pending_payouts_amount NUMERIC,
  pending_payouts_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(gross_amount)::NUMERIC / 100, 0) as total_captured,
    COALESCE(SUM(seller_amount)::NUMERIC / 100, 0) as total_owed_to_sellers,
    COALESCE(SUM(platform_commission)::NUMERIC / 100, 0) as total_platform_commission,
    COALESCE(SUM(estimated_processor_fees)::NUMERIC / 100, 0) as total_estimated_fees,
    COALESCE(SUM(net_platform_revenue)::NUMERIC / 100, 0) as total_net_revenue,
    COALESCE(SUM(CASE WHEN status = 'pending' THEN seller_amount ELSE 0 END)::NUMERIC / 100, 0) as pending_payouts_amount,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_payouts_count
  FROM public.adyen_payouts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;