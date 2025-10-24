import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { logger } from "../_shared/logger.ts";
import {
  compose,
  withCors,
  withRateLimit,
  withValidation,
  successResponse,
  errorResponse,
  Handler,
  HandlerContext,
} from "../_shared/middleware.ts";
import { createServiceClient } from "../_shared/supabase-utils.ts";

const schema = z.object({
  transaction_id: z.string().uuid(),
  reporter_id: z.string().uuid(),
  reason: z.string().min(1),
});

const handler: Handler = async (_req: Request, ctx: HandlerContext) => {
  const { transaction_id, reporter_id, reason } = ctx.body as z.infer<typeof schema>;
  const admin = createServiceClient();

  try {
    logger.info("[TEST-CREATE-DISPUTE] Start", { transaction_id, reporter_id });

    // Load transaction
    const { data: tx, error: txErr } = await admin
      .from("transactions")
      .select("id, user_id, buyer_id, status, conversation_id, title")
      .eq("id", transaction_id)
      .maybeSingle();

    if (txErr || !tx) {
      return errorResponse("Transaction not found", 404);
    }
    if (tx.status !== "paid") {
      return errorResponse("Transaction must be paid", 400);
    }

    // Ensure a conversation exists (dedicated dispute conversation)
    let conversationId = tx.conversation_id as string | null;
    if (!conversationId) {
      const { data: conv, error: convErr } = await admin
        .from("conversations")
        .insert({
          seller_id: tx.user_id,
          buyer_id: tx.buyer_id,
          transaction_id: tx.id,
          conversation_type: "dispute",
          status: "active",
        })
        .select("id")
        .single();
      if (convErr) return errorResponse(convErr.message, 400);
      conversationId = conv.id;

      // Also link transaction to base conversation if missing
      await admin.from("transactions").update({ conversation_id: conversationId }).eq("id", tx.id);
    }

    // Create dispute (conversation_id is mandatory per trigger)
    const { data: dispute, error: disputeErr } = await admin
      .from("disputes")
      .insert({
        transaction_id: tx.id,
        reporter_id,
        dispute_type: "quality_issue",
        reason,
        status: "open",
        conversation_id: conversationId,
        dispute_deadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      })
      .select("id")
      .single();

    if (disputeErr) return errorResponse(disputeErr.message, 400);

    logger.info("[TEST-CREATE-DISPUTE] Success", { dispute_id: dispute.id });
    return successResponse({ disputeId: dispute.id });
  } catch (e) {
    logger.error("[TEST-CREATE-DISPUTE] Exception", { e: String(e) });
    return errorResponse("Unexpected error", 500);
  }
};

Deno.serve(
  compose(
    withCors,
    withRateLimit({ maxRequests: 100, windowMs: 60_000 }),
    withValidation(schema)
  )(handler)
);
