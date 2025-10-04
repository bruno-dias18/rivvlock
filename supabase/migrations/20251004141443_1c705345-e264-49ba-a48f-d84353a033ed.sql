-- Harden shared link tokens and admin role auditing
-- 1) Trigger to enforce secure shared link token generation and expiration
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_secure_shared_link_token'
  ) THEN
    CREATE TRIGGER trg_secure_shared_link_token
    BEFORE INSERT OR UPDATE OF shared_link_token, shared_link_expires_at ON public.transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.secure_shared_link_token();
  END IF;
END $$;

-- 2) Helpful indexes for abuse detection and token lookups
CREATE INDEX IF NOT EXISTS idx_transactions_shared_link_token ON public.transactions (shared_link_token);
CREATE INDEX IF NOT EXISTS idx_transaction_access_attempts_token ON public.transaction_access_attempts (token);
CREATE INDEX IF NOT EXISTS idx_transaction_access_attempts_ip ON public.transaction_access_attempts (ip_address);
CREATE INDEX IF NOT EXISTS idx_transaction_access_attempts_created_at ON public.transaction_access_attempts (created_at);

-- 3) Audit all admin role changes strictly
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_admin_role_audit_detailed'
  ) THEN
    CREATE TRIGGER trg_admin_role_audit_detailed
    AFTER INSERT OR UPDATE OR DELETE ON public.admin_roles
    FOR EACH ROW EXECUTE FUNCTION public.log_admin_role_change_detailed();
  END IF;
END $$;