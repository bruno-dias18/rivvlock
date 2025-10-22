// Edge function pour nettoyer les anciennes entrées de rate limiting
// À appeler via pg_cron toutes les heures

import { createClient } from "jsr:@supabase/supabase-js@2";
import { errorResponse, successResponse, corsHeaders } from "../_shared/response-helpers.ts";

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    console.log('Starting rate limit cleanup...');

    // Appeler la fonction de nettoyage
    const { error } = await supabase.rpc('cleanup_old_rate_limits');

    if (error) {
      console.error('Cleanup error:', error);
      return errorResponse('Cleanup failed', 500);
    }

    console.log('Rate limit cleanup completed successfully');
    return successResponse({ message: 'Cleanup completed' });

  } catch (error) {
    console.error('Unexpected error during cleanup:', error);
    return errorResponse('Internal server error', 500);
  }
});
