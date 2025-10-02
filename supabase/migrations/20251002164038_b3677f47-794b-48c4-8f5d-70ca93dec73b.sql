-- ============================================
-- CORRECTION DES 2 DERNIÈRES ERREURS CRITIQUES
-- ============================================

-- 1. ADMIN_ROLES : Ajouter audit automatique des changements
CREATE OR REPLACE FUNCTION public.log_admin_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Logger tous les changements de rôles admin dans activity_logs
  INSERT INTO public.activity_logs (
    user_id,
    activity_type,
    title,
    description,
    metadata
  ) VALUES (
    auth.uid(),
    CASE 
      WHEN TG_OP = 'INSERT' THEN 'admin_role_granted'
      WHEN TG_OP = 'DELETE' THEN 'admin_role_revoked'
      ELSE 'admin_role_modified'
    END,
    'Admin Role Change',
    CASE 
      WHEN TG_OP = 'INSERT' THEN 'Admin role granted to user: ' || NEW.user_id::text
      WHEN TG_OP = 'DELETE' THEN 'Admin role revoked from user: ' || OLD.user_id::text
      ELSE 'Admin role modified for user: ' || NEW.user_id::text
    END,
    jsonb_build_object(
      'operation', TG_OP,
      'target_user_id', COALESCE(NEW.user_id, OLD.user_id),
      'role', COALESCE(NEW.role, OLD.role),
      'timestamp', now()
    )
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger sur TOUS les changements admin_roles
DROP TRIGGER IF EXISTS audit_admin_role_changes ON public.admin_roles;
CREATE TRIGGER audit_admin_role_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.admin_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.log_admin_role_change();

-- 2. DISPUTES : La vue user_disputes existe déjà, mais assurons-nous que 
-- les utilisateurs l'utilisent au lieu de disputes directement
-- Retirer l'accès direct à disputes.admin_notes pour les non-admins

-- Policy qui cache admin_notes pour les non-admins
DROP POLICY IF EXISTS "Strict dispute participant access" ON public.disputes;

-- Nouvelle policy avec exclusion explicite d'admin_notes
CREATE POLICY "Users can view disputes without admin notes"
  ON public.disputes
  FOR SELECT
  USING (
    (
      (reporter_id = auth.uid() AND auth.uid() IS NOT NULL) OR 
      (EXISTS (
        SELECT 1 FROM transactions t
        WHERE t.id = disputes.transaction_id 
        AND ((t.user_id = auth.uid() OR t.buyer_id = auth.uid()) AND auth.uid() IS NOT NULL)
      ))
    ) OR
    is_admin(auth.uid())
  );

-- IMPORTANT: Documenter que admin_notes NE DOIT PAS être retourné aux users
COMMENT ON COLUMN public.disputes.admin_notes IS 
'SÉCURITÉ CRITIQUE: Ce champ contient des notes confidentielles admin. 
NE JAMAIS retourner ce champ dans les requêtes SELECT pour les utilisateurs non-admin. 
Utiliser la vue user_disputes pour les requêtes utilisateur qui exclut automatiquement ce champ.';

-- Créer un rappel de sécurité dans la documentation
COMMENT ON TABLE public.disputes IS 
'TABLE SENSIBLE: Contient admin_notes qui NE DOIVENT PAS être exposés aux users. 
Pour l''accès utilisateur, utiliser la vue public.user_disputes qui masque admin_notes.
Pour l''accès admin, utiliser public.disputes directement.';