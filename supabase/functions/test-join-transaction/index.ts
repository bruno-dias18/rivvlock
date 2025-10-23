import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { logger } from "../_shared/logger.ts";
import {
  compose,
  withCors,
  withRateLimit,
  withValidation,
  successResponse,
  Handler,
  HandlerContext,
} from "../_shared/middleware.ts";
import { createServiceClient } from "../_shared/supabase-utils.ts";

const joinSchema = z.object({
  transaction_id: z.string().uuid(),
  buyer_id: z.string().uuid(),
  token: z.string().min(16),
});

function getAllowedDomains() {
  return `${Deno.env.get("TEST_ALLOWED_EMAIL_DOMAINS") || ""},gmail.com,outlook.com,test-rivvlock.com,example.org,example.com`
    .split(",")
    .map((d) => d.replace(/^@/, "").trim().toLowerCase())
    .filter(Boolean);
}

const handler: Handler = async (_req: Request, ctx: HandlerContext) => {
  const { transaction_id, buyer_id, token } = ctx.body as z.infer<typeof joinSchema>;
  const admin = createServiceClient();

  logger.info("[TEST-JOIN-TRANSACTION] Start", { transaction_id, buyer_id });

  // Validate transaction + token
  const { data: tx, error: txErr } = await admin
    .from("transactions")
    .select("id, user_id, buyer_id, shared_link_token, shared_link_expires_at")
    .eq("id", transaction_id)
    .maybeSingle();

  if (txErr || !tx) {
    logger.warn("[TEST-JOIN-TRANSACTION] Transaction not found", { error: txErr?.message });
    return new Response(JSON.stringify({ error: "Transaction not found" }), {
      headers: { "Content-Type": "application/json" },
      status: 404,
    });
  }

  if (!tx.shared_link_token || tx.shared_link_token !== token) {
    logger.warn("[TEST-JOIN-TRANSACTION] Invalid token");
    return new Response(JSON.stringify({ error: "Invalid token" }), {
      headers: { "Content-Type": "application/json" },
      status: 403,
    });
  }
  if (tx.shared_link_expires_at && new Date(tx.shared_link_expires_at) < new Date()) {
    logger.warn("[TEST-JOIN-TRANSACTION] Token expired");
    return new Response(JSON.stringify({ error: "Token expired" }), {
      headers: { "Content-Type": "application/json" },
      status: 403,
    });
  }

  if (tx.user_id === buyer_id) {
    return new Response(JSON.stringify({ error: "Cannot join own transaction" }), {
      headers: { "Content-Type": "application/json" },
      status: 400,
    });
  }

  // Validate buyer email domain allowlist
  const { data: buyerRes, error: buyerErr } = await admin.auth.admin.getUserById(buyer_id);
  const email = buyerRes?.user?.email?.toLowerCase();
  const allowed = getAllowedDomains();
  const ok = !!email && allowed.some((d) => email!.endsWith(`@${d}`));
  logger.info("[TEST-JOIN-TRANSACTION] Buyer domain check", { email, ok });
  if (buyerErr || !ok) {
    return new Response(JSON.stringify({ error: "Buyer not allowed" }), {
      headers: { "Content-Type": "application/json" },
      status: 403,
    });
  }

  // Attach buyer if empty or already same
  const { error: updErr } = await admin
    .from("transactions")
    .update({ buyer_id })
    .eq("id", transaction_id)
    .is("buyer_id", null);

  if (updErr) {
    logger.error("[TEST-JOIN-TRANSACTION] Update failed", { error: updErr.message });
    return new Response(JSON.stringify({ error: updErr.message }), {
      headers: { "Content-Type": "application/json" },
      status: 400,
    });
  }

  logger.info("[TEST-JOIN-TRANSACTION] Success", { transaction_id, buyer_id });
  return successResponse({ ok: true, transaction_id, buyer_id });
};

Deno.serve(
  compose(
    withCors,
    withRateLimit({ maxRequests: 100, windowMs: 60_000 }),
    withValidation(joinSchema)
  )(handler)
);
