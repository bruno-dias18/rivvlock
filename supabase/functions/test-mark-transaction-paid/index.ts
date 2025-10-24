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
  payment_intent_id: z.string().min(3).optional(),
  status: z.enum(["paid", "completed"]).optional().default("paid"),
  set_blocked_now: z.boolean().optional(),
  validation_hours: z.number().int().min(1).max(24 * 14).optional(),
});

const handler: Handler = async (_req: Request, ctx: HandlerContext) => {
  const {
    transaction_id,
    payment_intent_id,
    status = "paid",
    set_blocked_now = false,
    validation_hours = 72,
  } = ctx.body as z.infer<typeof schema>;

  const admin = createServiceClient();

  try {
    logger.info("[TEST-MARK-PAID] Start", { transaction_id, status, set_blocked_now });

    // Load transaction and basic validation
    const { data: tx, error: txErr } = await admin
      .from("transactions")
      .select("id, buyer_id, status")
      .eq("id", transaction_id)
      .maybeSingle();

    if (txErr || !tx) {
      logger.warn("[TEST-MARK-PAID] Not found", { err: txErr?.message });
      return errorResponse("Transaction not found", 404);
    }

    // Allow marking as paid even if buyer_id not yet attached (E2E helper resilience)
    // Proceed without blocking to avoid race conditions in tests.

    const update: Record<string, any> = { status };
    if (payment_intent_id) update.stripe_payment_intent_id = payment_intent_id;

    if (set_blocked_now) {
      const now = new Date();
      const deadline = new Date(now.getTime() + validation_hours * 60 * 60 * 1000);
      update.validation_deadline = deadline.toISOString();
    }

    const { error: updErr } = await admin
      .from("transactions")
      .update(update)
      .eq("id", transaction_id);

    if (updErr) {
      logger.error("[TEST-MARK-PAID] Update failed", { err: updErr.message });
      return errorResponse(updErr.message, 400);
    }

    logger.info("[TEST-MARK-PAID] Success", { transaction_id });
    return successResponse({ ok: true, transaction_id });
  } catch (e) {
    logger.error("[TEST-MARK-PAID] Exception", { e: String(e) });
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
