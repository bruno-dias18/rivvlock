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

// Input validation
const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  role: z.enum(["admin"]).optional(),
});

const handler: Handler = async (req: Request, ctx: HandlerContext) => {
  const { email, password } = ctx.body as z.infer<typeof createUserSchema>;

  logger.info("[TEST-CREATE-USER] Start", { email });

  const allowAll = (Deno.env.get("TEST_ALLOW_ALL_EMAILS") || "").toLowerCase() === "true";
  const allowedSecret = Deno.env.get("TEST_ALLOWED_EMAIL_DOMAINS") || "";
  const allowed = `${allowedSecret},gmail.com,outlook.com,test-rivvlock.com,example.org,example.com`
    .split(",")
    .map((d) => d.replace(/^@/, "").trim().toLowerCase())
    .filter(Boolean);
  
  // Enforce domain allowlist unless TEST_ALLOW_ALL_EMAILS=true
  if (!allowAll) {
    const isAllowed = allowed.some((d) => email.toLowerCase().endsWith(`@${d}`));
    logger.info("[TEST-CREATE-USER] Domain check", { email, allowed, isAllowed });
    if (!isAllowed) {
      logger.warn("[TEST-CREATE-USER] Non-allowed email", { email, allowed });
      return new Response(JSON.stringify({ error: "Not allowed" }), {
        headers: { "Content-Type": "application/json" },
        status: 403,
      });
    }
  } else {
    logger.info("[TEST-CREATE-USER] TEST_ALLOW_ALL_EMAILS enabled - skipping domain check", { email });
  }

  logger.info("[TEST-CREATE-USER] Email allowed, creating user");
  const admin = createServiceClient();

  // Create user via admin API (bypasses signup restrictions)
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // ensure immediate login possible
  });

  if (error) {
    logger.error("[TEST-CREATE-USER] createUser error", { error: error.message });
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 400,
    });
  }

  logger.info("[TEST-CREATE-USER] User created successfully", { user_id: data.user?.id });

  // Optional: assign admin role when requested by tests
  try {
    const requestedRole = (ctx.body as any)?.role;
    if (requestedRole === 'admin' && data.user?.id) {
      const { error: roleErr } = await admin
        .from('user_roles')
        .upsert({ user_id: data.user.id, role: 'admin' }, { onConflict: 'user_id,role' });
      if (roleErr) {
        logger.warn('[TEST-CREATE-USER] role upsert failed', { error: roleErr.message });
      } else {
        logger.info('[TEST-CREATE-USER] admin role assigned', { user_id: data.user.id });
      }
    }
  } catch (e) {
    logger.warn('[TEST-CREATE-USER] role assignment attempt failed', { error: String(e) });
  }

  return successResponse({ user_id: data.user?.id, email });
};

const maxRequests = Number(Deno.env.get("TEST_RATE_LIMIT_MAX") || "1000");
const windowMs = Number(Deno.env.get("TEST_RATE_LIMIT_WINDOW_MS") || "60000");

Deno.serve(
  compose(withCors, withRateLimit({ maxRequests, windowMs }), withValidation(createUserSchema))(handler)
);
