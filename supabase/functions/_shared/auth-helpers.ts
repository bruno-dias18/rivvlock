/**
 * Authentication Helper Functions for Edge Functions
 * 
 * Provides reusable authentication and authorization utilities
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

/**
 * Extract and verify user from Authorization header
 */
export async function authenticateUser(req: Request): Promise<{
  userId: string;
  email: string;
  supabaseClient: any;
}> {
  const authHeader = req.headers.get("Authorization");
  
  if (!authHeader) {
    throw new Error("No authorization header provided");
  }

  const token = authHeader.replace("Bearer ", "");
  
  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

  if (userError || !user?.email) {
    throw new Error("User not authenticated or email not available");
  }

  return {
    userId: user.id,
    email: user.email,
    supabaseClient,
  };
}

/**
 * Create admin client (service role)
 */
export function createAdminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );
}

/**
 * Check if user is admin
 */
export async function isAdmin(userId: string): Promise<boolean> {
  const adminClient = createAdminClient();
  
  const { data, error } = await adminClient
    .rpc('is_admin', { check_user_id: userId });

  if (error) {
    console.error('Error checking admin status:', error);
    return false;
  }

  return data === true;
}

/**
 * Verify transaction ownership
 */
export async function verifyTransactionOwnership(
  transactionId: string,
  userId: string
): Promise<boolean> {
  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from('transactions')
    .select('user_id, buyer_id')
    .eq('id', transactionId)
    .single();

  if (error || !data) return false;

  return data.user_id === userId || data.buyer_id === userId;
}
