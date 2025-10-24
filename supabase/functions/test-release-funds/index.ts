import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import {
  compose,
  withCors,
  withValidation,
  successResponse,
  errorResponse,
  Handler,
  HandlerContext,
} from "../_shared/middleware.ts";
import { createServiceClient } from "../_shared/supabase-utils.ts";

const schema = z.object({
  transaction_id: z.string().uuid(),
});

const handler: Handler = async (_req: Request, ctx: HandlerContext) => {
  const { transaction_id } = ctx.body as z.infer<typeof schema>;
  const admin = createServiceClient();

  try {
    // Validate transaction exists
    const { data: tx, error: txErr } = await admin
      .from("transactions")
      .select("id, status")
      .eq("id", transaction_id)
      .maybeSingle();

    if (txErr || !tx) {
      return errorResponse("Transaction not found", 404);
    }

    // Directly mark as validated and funds released (E2E helper)
    const now = new Date().toISOString();
    const { error: updErr } = await admin
      .from("transactions")
      .update({
        status: "validated",
        funds_released: true,
        funds_released_at: now,
        updated_at: now,
      })
      .eq("id", transaction_id);

    if (updErr) {
      return errorResponse(updErr.message, 400);
    }

    return successResponse({ success: true, transaction_id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return errorResponse(msg, 500);
  }
};

Deno.serve(
  compose(
    withCors,
    withValidation(schema)
  )(handler)
);
