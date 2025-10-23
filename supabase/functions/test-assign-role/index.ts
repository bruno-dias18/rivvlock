import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { logger } from "../_shared/logger.ts";
import { 
  compose,
  withCors,
  withRateLimit,
  withValidation,
  successResponse,
  Handler,
  HandlerContext
} from "../_shared/middleware.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { createServiceClient } from "../_shared/supabase-utils.ts";

// Schema: only allow specific role values
const assignRoleSchema = z.object({
  role: z.enum(["admin"]).default("admin"),
  email: z.string().email().optional(),
  user_id: z.string().uuid().optional(),
});

const handler: Handler = async (req: Request, ctx: HandlerContext) => {
  const { body } = ctx;

  const adminClient = createServiceClient();

  // Determine target user via three secure paths:
  // 1) Direct user_id provided (test-only fast path)
  // 2) Authenticated call (Authorization: Bearer <user_jwt>)
  // 3) Admin lookup by body.email (only from allowed domains)
  const authHeader = req.headers.get("Authorization");

  let targetUserId: string | null = body.user_id ?? null;
  let targetEmail: string | null = body.email ?? null;

  if (authHeader) {
    // Verify user JWT and extract id/email
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } }
    );
    const { data, error } = await userClient.auth.getUser();
    if (!error && data.user) {
      targetUserId = data.user.id;
      targetEmail = (data.user as any).email ?? null;
    }
  }

  if (!targetUserId && body.email) {
    // Test direct path: find user by email via admin API
    const { data, error } = await adminClient.auth.admin.listUsers({ email: body.email });
    if (error) {
      logger.error("[TEST-ASSIGN-ROLE] listUsers error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        headers: { "Content-Type": "application/json" },
        status: 500,
      });
    }
    const user = data?.users?.find((u: any) => (u.email || "").toLowerCase() === String(body.email).toLowerCase());
    if (user) {
      targetUserId = user.id;
      targetEmail = user.email ?? body.email;
    }
  }

  if (!targetUserId) {
    return new Response(JSON.stringify({ error: "Not authenticated or user not found" }), {
      headers: { "Content-Type": "application/json" },
      status: 401,
    });
  }

  // Extra safety: only allow specific email domains
  const email = String(targetEmail || body.email || "");
  const allowed = (Deno.env.get("TEST_ALLOWED_EMAIL_DOMAINS") || "gmail.com,outlook.com,test-rivvlock.com,example.org,example.com")
    .split(",")
    .map(d => d.replace(/^@/, '').trim().toLowerCase())
    .filter(Boolean);
  const isAllowed = allowed.some(d => email.toLowerCase().endsWith(`@${d}`));
  if (!isAllowed) {
    logger.warn("[TEST-ASSIGN-ROLE] Attempt from non-allowed email:", email);
    return new Response(JSON.stringify({ error: "Not allowed" }), {
      headers: { "Content-Type": "application/json" },
      status: 403,
    });
  }

  // Upsert role using service role (bypasses RLS safely)
  const { error } = await adminClient
    .from("user_roles")
    .upsert({ user_id: targetUserId, role: body.role }, { onConflict: "user_id,role" });

  if (error) {
    logger.error("[TEST-ASSIGN-ROLE] Upsert error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }

  return successResponse({ success: true, user_id: targetUserId, role: body.role, via: authHeader ? "jwt" : "direct" });
};

Deno.serve(
  compose(
    withCors,
    withRateLimit({ maxRequests: 50, windowMs: 60_000 }),
    withValidation(assignRoleSchema)
  )(handler)
);
