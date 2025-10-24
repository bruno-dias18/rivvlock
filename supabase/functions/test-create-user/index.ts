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
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

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
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  // Create user via admin API with duplicate-handling retries
  let createdUserId: string | null = null;
  let finalEmail = email;
  let lastErr: any = null;

  for (let attempt = 1; attempt <= 5; attempt++) {
    const { data, error } = await admin.auth.admin.createUser({
      email: finalEmail,
      password,
      email_confirm: true, // ensure immediate login possible
    });

    if (!error && data?.user?.id) {
      createdUserId = data.user.id;
      logger.info("[TEST-CREATE-USER] User created successfully", { user_id: createdUserId, email: finalEmail, attempt });
      break;
    }

    lastErr = error;
    // If the email already exists, try to sign in and reuse it; otherwise alias and retry
    if (error?.message?.toLowerCase().includes("already been registered")) {
      try {
        const { data: signInData, error: signInErr } = await userClient.auth.signInWithPassword({
          email: finalEmail,
          password,
        });
        if (!signInErr && signInData?.user?.id) {
          createdUserId = signInData.user.id;
          logger.info("[TEST-CREATE-USER] Existing user reused after sign-in", { user_id: createdUserId, email: finalEmail, attempt });
          break;
        }
      } catch (_) {
        // ignore and alias
      }
      const [local, domain] = finalEmail.split("@");
      const baseLocal = local.split("+")[0];
      const suffix = `${Date.now() % 1_000_000}-${attempt}-${Math.random().toString(36).slice(2, 6)}`;
      finalEmail = `${baseLocal}+e2e-${suffix}@${domain}`;
      logger.warn("[TEST-CREATE-USER] Duplicate email, retrying with alias", { next_email: finalEmail, attempt });
      continue;
    }

    // Non-duplicate error -> stop and return
    logger.error("[TEST-CREATE-USER] createUser error (non-duplicate)", { error: error?.message, attempt });
    break;
  }

  if (!createdUserId) {
    const message = lastErr?.message || "createUser failed";
    return new Response(JSON.stringify({ error: message }), {
      headers: { "Content-Type": "application/json" },
      status: 400,
    });
  }

  // Optional: assign admin role when requested by tests
  try {
    const requestedRole = (ctx.body as any)?.role;
    if (requestedRole === 'admin' && createdUserId) {
      const { error: roleErr } = await admin
        .from('user_roles')
        .upsert({ user_id: createdUserId, role: 'admin' }, { onConflict: 'user_id,role' });
      if (roleErr) {
        logger.warn('[TEST-CREATE-USER] role upsert failed', { error: roleErr.message });
      } else {
        logger.info('[TEST-CREATE-USER] admin role assigned', { user_id: createdUserId });
      }
    }
  } catch (e) {
    logger.warn('[TEST-CREATE-USER] role assignment attempt failed', { error: String(e) });
  }

  return successResponse({ user_id: createdUserId, email: finalEmail });
};

const maxRequests = Number(Deno.env.get("TEST_RATE_LIMIT_MAX") || "1000");
const windowMs = Number(Deno.env.get("TEST_RATE_LIMIT_WINDOW_MS") || "60000");

Deno.serve(
  compose(withCors, withRateLimit({ maxRequests, windowMs }), withValidation(createUserSchema))(handler)
);
