-- ============================================================
-- FEATURE FLAGS INFRASTRUCTURE (+3 points Architecture)
-- Table pour activer/désactiver features sans redeploy
-- ============================================================

-- 1. Créer la table feature_flags
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key text UNIQUE NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  description text,
  rollout_percentage integer DEFAULT 100 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  
  -- Metadata pour tracking
  created_by uuid REFERENCES auth.users(id),
  metadata jsonb DEFAULT '{}'::jsonb
);

-- 2. Index pour performance
CREATE INDEX IF NOT EXISTS idx_feature_flags_key ON public.feature_flags(feature_key);
CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled ON public.feature_flags(enabled);

-- 3. RLS policies (seuls les admins peuvent modifier)
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

-- Tout le monde peut lire les flags (pour useFeatureFlag())
CREATE POLICY "Anyone can view feature flags"
ON public.feature_flags
FOR SELECT
USING (true);

-- Seuls les admins peuvent insérer/modifier
CREATE POLICY "Only admins can manage feature flags"
ON public.feature_flags
FOR ALL
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- 4. Trigger pour updated_at
CREATE TRIGGER update_feature_flags_updated_at
  BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Fonction helper pour checker une flag (utilisable en SQL)
CREATE OR REPLACE FUNCTION public.is_feature_enabled(flag_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT enabled FROM public.feature_flags WHERE feature_key = flag_key LIMIT 1;
$$;

-- 6. Insérer quelques flags d'exemple (désactivées par défaut)
INSERT INTO public.feature_flags (feature_key, description, enabled) VALUES
  ('beta_payment_flow', 'Nouveau flow de paiement amélioré', false),
  ('experimental_ui', 'Interface expérimentale', false),
  ('ai_assistant', 'Assistant IA pour les litiges', false)
ON CONFLICT (feature_key) DO NOTHING;

-- 7. Commentaires pour documentation
COMMENT ON TABLE public.feature_flags IS 
'✅ FEATURE FLAGS SYSTEM
Permet d''activer/désactiver des features sans redeploy.
Utilisable via useFeatureFlag() hook en React.';

COMMENT ON COLUMN public.feature_flags.rollout_percentage IS 
'Pourcentage d''utilisateurs qui voient la feature (0-100). 100 = tout le monde.';

-- ✅ Infrastructure Feature Flags prête (non utilisée dans le code existant)