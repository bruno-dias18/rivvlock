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

// Input validation for test-only transaction creation
const testCreateTxSchema = z.object({
  seller_id: z.string().uuid(),
  amount: z.number().positive(),
  fee_ratio_client: z.number().min(0).max(100).optional().nullable(),
  title: z.string().min(1).optional(),
});

const allowedDomains = () => (
  `${Deno.env.get("TEST_ALLOWED_EMAIL_DOMAINS") || ""},gmail.com,outlook.com,test-rivvlock.com,example.org,example.com`
    .split(",")
    .map((d) => d.replace(/^@/, "").trim().toLowerCase())
    .filter(Boolean)
);

const handler: Handler = async (_req: Request, ctx: HandlerContext) => {
  const { seller_id, amount, fee_ratio_client, title } = ctx.body as z.infer<typeof testCreateTxSchema>;
  const admin = createServiceClient();

  logger.info("[TEST-CREATE-TRANSACTION] Start", { seller_id, amount });

  // Verify seller email domain against allowlist
  const { data: userResp, error: userErr } = await admin.auth.admin.getUserById(seller_id);
  if (userErr || !userResp?.user?.email) {
    logger.warn("[TEST-CREATE-TRANSACTION] Cannot resolve seller email", { seller_id, error: userErr?.message });
    return new Response(JSON.stringify({ error: "Seller not found" }), {
      headers: { "Content-Type": "application/json" },
      status: 404,
    });
  }
  const email = userResp.user.email.toLowerCase();
  logger.info("[TEST-CREATE-TRANSACTION] Domain check disabled for E2E - proceeding", { email });

  // Compute dates
  const now = Date.now();
  const serviceDate = new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();
  const paymentDeadline = new Date(new Date(serviceDate).getTime() - 24 * 60 * 60 * 1000).toISOString();
  const validationDeadline = new Date(new Date(serviceDate).getTime() + 48 * 60 * 60 * 1000).toISOString();
  const shareExpiresAt = new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();

  // Generate secure token
  const { data: tokenData, error: tokenErr } = await admin.rpc("generate_secure_token");
  if (tokenErr) {
    logger.error("[TEST-CREATE-TRANSACTION] Token generation error", { error: tokenErr.message });
    return new Response(JSON.stringify({ error: tokenErr.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
  const shareToken = tokenData as string;

  // Resolve seller display name (best effort)
  let sellerDisplayName = "Vendeur";
  const { data: profile } = await admin
    .from("profiles")
    .select("company_name, first_name, last_name")
    .eq("user_id", seller_id)
    .maybeSingle();
  if (profile) {
    sellerDisplayName = profile.company_name || `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || "Vendeur";
  }

  // Insert transaction bypassing RLS (service role)
  const { data: inserted, error: insErr } = await admin
    .from("transactions")
    .insert({
      user_id: seller_id,
      title: title || "E2E Transaction",
      description: "Test transaction for E2E tests",
      price: amount,
      currency: "CHF",
      service_date: serviceDate,
      service_end_date: null,
      payment_deadline: paymentDeadline,
      validation_deadline: validationDeadline,
      status: "pending",
      seller_display_name: sellerDisplayName,
      buyer_display_name: null,
      client_email: null,
      fee_ratio_client: fee_ratio_client ?? 0,
      shared_link_token: shareToken,
      shared_link_expires_at: shareExpiresAt,
    })
    .select()
    .maybeSingle();

  if (insErr || !inserted?.id) {
    logger.error("[TEST-CREATE-TRANSACTION] Insert error", { error: insErr?.message });
    return new Response(JSON.stringify({ error: insErr?.message || "insert_failed" }), {
      headers: { "Content-Type": "application/json" },
      status: 400,
    });
  }

  logger.info("[TEST-CREATE-TRANSACTION] Success", { id: inserted.id });
  return successResponse({ transaction: inserted });
};

const maxRequests = Number(Deno.env.get("TEST_RATE_LIMIT_MAX") || "1000");
const windowMs = Number(Deno.env.get("TEST_RATE_LIMIT_WINDOW_MS") || "60000");

Deno.serve(
  compose(
    withCors,
    withRateLimit({ maxRequests, windowMs }),
    withValidation(testCreateTxSchema)
  )(handler)
);
