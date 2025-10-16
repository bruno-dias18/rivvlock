-- ============================================
-- PARTIE 1 : Tables du système de devis
-- ============================================

-- Table principale des devis
CREATE TABLE IF NOT EXISTS quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  client_email TEXT NOT NULL,
  client_name TEXT,
  title TEXT NOT NULL,
  description TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC(10,2) NOT NULL,
  tax_rate NUMERIC(5,2),
  tax_amount NUMERIC(10,2),
  total_amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL,
  service_date TIMESTAMPTZ,
  service_end_date TIMESTAMPTZ,
  valid_until TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  status TEXT NOT NULL DEFAULT 'pending',
  secure_token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'base64'),
  token_expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '90 days'),
  converted_transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT quotes_status_check CHECK (status IN ('pending', 'negotiating', 'accepted', 'refused', 'expired', 'archived')),
  CONSTRAINT quotes_currency_check CHECK (currency IN ('eur', 'chf'))
);

-- Messages de négociation de devis
CREATE TABLE IF NOT EXISTS quote_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  sender_email TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  message TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT quote_messages_type_check CHECK (message_type IN ('text', 'proposal_update'))
);

-- Historique des révisions de devis
CREATE TABLE IF NOT EXISTS quote_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL,
  items JSONB NOT NULL,
  total_amount NUMERIC(10,2) NOT NULL,
  changed_by UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  change_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(quote_id, revision_number)
);

-- ============================================
-- PARTIE 2 : Système de proposition de dates
-- ============================================

-- Ajout colonnes pour messages de transaction (backward-compatible)
ALTER TABLE transaction_messages 
ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text';

ALTER TABLE transaction_messages 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transaction_messages_type_check'
  ) THEN
    ALTER TABLE transaction_messages
    ADD CONSTRAINT transaction_messages_type_check 
    CHECK (message_type IN ('text', 'date_proposal', 'date_confirmed'));
  END IF;
END $$;

-- ============================================
-- INDEXES pour performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_quotes_seller ON quotes(seller_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_token ON quotes(secure_token);
CREATE INDEX IF NOT EXISTS idx_quotes_created ON quotes(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_quote_messages_quote ON quote_messages(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_messages_created ON quote_messages(created_at ASC);

CREATE INDEX IF NOT EXISTS idx_quote_revisions_quote ON quote_revisions(quote_id);

CREATE INDEX IF NOT EXISTS idx_transaction_messages_type ON transaction_messages(transaction_id, message_type);

-- ============================================
-- RLS POLICIES - Quotes
-- ============================================

ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

-- Vendeurs peuvent voir leurs propres devis
CREATE POLICY "quotes_select_seller" ON quotes
  FOR SELECT
  USING (seller_id = auth.uid());

-- Service role peut tout faire (pour edge functions)
CREATE POLICY "quotes_all_service_role" ON quotes
  FOR ALL
  USING (true);

-- Vendeurs peuvent créer des devis
CREATE POLICY "quotes_insert_seller" ON quotes
  FOR INSERT
  WITH CHECK (seller_id = auth.uid());

-- Vendeurs peuvent mettre à jour leurs devis
CREATE POLICY "quotes_update_seller" ON quotes
  FOR UPDATE
  USING (seller_id = auth.uid());

-- ============================================
-- RLS POLICIES - Quote Messages
-- ============================================

ALTER TABLE quote_messages ENABLE ROW LEVEL SECURITY;

-- Participants (vendeur) peuvent voir messages
CREATE POLICY "quote_messages_select_participants" ON quote_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM quotes q 
      WHERE q.id = quote_messages.quote_id 
      AND q.seller_id = auth.uid()
    )
  );

-- Participants peuvent envoyer des messages
CREATE POLICY "quote_messages_insert_participants" ON quote_messages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quotes q 
      WHERE q.id = quote_messages.quote_id 
      AND (q.seller_id = auth.uid() OR sender_email = q.client_email)
    )
  );

-- Service role peut tout faire
CREATE POLICY "quote_messages_all_service_role" ON quote_messages
  FOR ALL
  USING (true);

-- ============================================
-- RLS POLICIES - Quote Revisions
-- ============================================

ALTER TABLE quote_revisions ENABLE ROW LEVEL SECURITY;

-- Vendeurs peuvent voir les révisions de leurs devis
CREATE POLICY "quote_revisions_select_seller" ON quote_revisions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM quotes 
      WHERE quotes.id = quote_revisions.quote_id 
      AND quotes.seller_id = auth.uid()
    )
  );

-- Service role peut tout faire
CREATE POLICY "quote_revisions_all_service_role" ON quote_revisions
  FOR ALL
  USING (true);

-- ============================================
-- TRIGGERS pour updated_at
-- ============================================

CREATE TRIGGER update_quotes_updated_at
  BEFORE UPDATE ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();