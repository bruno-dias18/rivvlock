import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { 
  compose, 
  withCors, 
  withAuth, 
  withValidation,
  successResponse, 
  errorResponse,
  Handler, 
  HandlerContext 
} from "../_shared/middleware.ts";

const schema = z.object({
  transactionId: z.string().uuid(),
});

const handler: Handler = async (req, ctx: HandlerContext) => {
  const { supabaseClient, adminClient, body } = ctx;
  const { transactionId } = body;
  
  try {
    // Check admin role via secure function
    const { data: isAdmin, error: adminErr } = await supabaseClient!.rpc("is_admin");
    if (adminErr || !isAdmin) {
      return errorResponse("Not authorized", 403);
    }

    // Service role client to bypass RLS safely after admin check
    const { data, error } = await adminClient!
      .from("transactions")
      .select(
        "id, title, price, currency, service_date, status, seller_display_name, buyer_display_name, user_id, buyer_id"
      )
      .eq("id", transactionId)
      .maybeSingle();

    if (error) {
      return errorResponse(error.message, 400);
    }

    return successResponse({ transaction: data ?? null });
  } catch (e) {
    return errorResponse(String(e), 500);
  }
};

const composedHandler = compose(withCors, withAuth, withValidation(schema))(handler);
serve(composedHandler);
