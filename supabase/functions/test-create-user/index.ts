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
});

const handler: Handler = async (req: Request, ctx: HandlerContext) => {
  const { email, password } = ctx.body as z.infer<typeof createUserSchema>;

  logger.info("[TEST-CREATE-USER] Start", { email });

  const allowedSecret = Deno.env.get("TEST_ALLOWED_EMAIL_DOMAINS") || "";
  const allowed = `${allowedSecret},gmail.com,outlook.com,test-rivvlock.com,example.org,example.com`
    .split(",")
    .map((d) => d.replace(/^@/, "").trim().toLowerCase())
    .filter(Boolean);
  
  logger.info("[TEST-CREATE-USER] Allowed domains", { allowed });
  
  const isAllowed = allowed.some((d) => email.toLowerCase().endsWith(`@${d}`));
  if (!isAllowed) {
    logger.warn("[TEST-CREATE-USER] Non-allowed email", { email, allowed });
    return new Response(JSON.stringify({ error: "Not allowed" }), {
      headers: { "Content-Type": "application/json" },
      status: 403,
    });
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
  return successResponse({ user_id: data.user?.id, email });
};

Deno.serve(
  compose(withCors, withRateLimit({ maxRequests: 100, windowMs: 60_000 }), withValidation(createUserSchema))(handler)
);
