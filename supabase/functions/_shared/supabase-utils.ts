import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

/**
 * Creates a Supabase client with service role permissions
 * Used across all edge functions for database operations
 */
export function createServiceClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
