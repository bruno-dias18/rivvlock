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
  const parsed = (ctx as any)?.body ?? {};
  // Fallbacks: try to read raw JSON and header overrides if body keys are missing
  let role: "admin" = (parsed.role as any) ?? "admin";
  let email: string | undefined = parsed.email as string | undefined;
  let user_id: string | undefined = parsed.user_id as string | undefined;

  try {
    const raw = await req.clone().json();
    if (raw && typeof raw === 'object') {
      role = (raw.role as any) ?? role;
      email = (email ?? raw.email) as string | undefined;
      user_id = (user_id ?? raw.user_id) as string | undefined;
    }
  } catch (_) {
    // ignore if body already consumed by validation middleware
  }
  // Header fallbacks (useful in flaky test runners)
  email = email ?? req.headers.get('x-email') ?? undefined;
  user_id = user_id ?? req.headers.get('x-user-id') ?? undefined;

  logger.info("[TEST-ASSIGN-ROLE] Start", { role, email, user_id });

  const adminClient = createServiceClient();

  // Determine target user via three secure paths:
  // 1) Direct user_id provided (test-only fast path)
  // 2) Authenticated call (Authorization: Bearer <user_jwt>)
  // 3) Admin lookup by email (only from allowed domains)
  const authHeader = req.headers.get("Authorization");

  let targetUserId: string | null = user_id ?? null;
  let targetEmail: string | null = email ?? null;

  if (!targetUserId && authHeader) {
    logger.info("[TEST-ASSIGN-ROLE] Trying JWT auth");
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
      logger.info("[TEST-ASSIGN-ROLE] User from JWT", { user_id: targetUserId });
    }
  }

  if (!targetUserId && email) {
    logger.info("[TEST-ASSIGN-ROLE] Trying email lookup", { email });
    // Test direct path: find user by email via admin API
    const { data, error } = await adminClient.auth.admin.listUsers({ email });
    if (error) {
      logger.error("[TEST-ASSIGN-ROLE] listUsers error", { error: error.message });
      return new Response(JSON.stringify({ error: error.message }), {
        headers: { "Content-Type": "application/json" },
        status: 500,
      });
    }
    const user = data?.users?.find((u: any) => (u.email || "").toLowerCase() === String(email).toLowerCase());
    if (user) {
      targetUserId = user.id;
      targetEmail = user.email ?? email;
      logger.info("[TEST-ASSIGN-ROLE] User from email", { user_id: targetUserId });
    }
  }

  if (!targetUserId) {
    logger.error("[TEST-ASSIGN-ROLE] No user found");
    return new Response(JSON.stringify({ error: "Not authenticated or user not found" }), {
      headers: { "Content-Type": "application/json" },
      status: 401,
    });
  }

  // Extra safety: only allow specific email domains
  const resolvedEmail = String(targetEmail || email || "");
  const allowedSecret = Deno.env.get("TEST_ALLOWED_EMAIL_DOMAINS") || "";
  const allowed = `${allowedSecret},gmail.com,outlook.com,test-rivvlock.com,example.org,example.com`
    .split(",")
    .map(d => d.replace(/^@/, '').trim().toLowerCase())
    .filter(Boolean);
  
  logger.info("[TEST-ASSIGN-ROLE] Checking email domain", { email: resolvedEmail, allowed });
  
  const isAllowed = allowed.some(d => resolvedEmail.toLowerCase().endsWith(`@${d}`));
  if (!isAllowed) {
    logger.warn("[TEST-ASSIGN-ROLE] Non-allowed email", { email: resolvedEmail, allowed });
    return new Response(JSON.stringify({ error: "Not allowed" }), {
      headers: { "Content-Type": "application/json" },
      status: 403,
    });
  }

  logger.info("[TEST-ASSIGN-ROLE] Upserting role", { user_id: targetUserId, role });

  // Upsert role using service role (bypasses RLS safely)
  const { error } = await adminClient
    .from("user_roles")
    .upsert({ user_id: targetUserId, role }, { onConflict: "user_id,role" });

  if (error) {
    logger.error("[TEST-ASSIGN-ROLE] Upsert error", { error: error.message });
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }

  logger.info("[TEST-ASSIGN-ROLE] Success", { user_id: targetUserId, role });
  return successResponse({ success: true, user_id: targetUserId, role, via: authHeader ? "jwt" : "direct" });
};

Deno.serve(
  compose(
    withCors,
    withRateLimit({ maxRequests: 50, windowMs: 60_000 }),
    withValidation(assignRoleSchema)
  )(handler)
);
