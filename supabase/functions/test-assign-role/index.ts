import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { logger } from "../_shared/logger.ts";
import { 
  compose,
  withCors,
  withAuth,
  withRateLimit,
  withValidation,
  successResponse,
  Handler,
  HandlerContext
} from "../_shared/middleware.ts";

// Schema: only allow specific role values
const assignRoleSchema = z.object({
  role: z.enum(["admin"]).default("admin"),
});

const handler: Handler = async (_req: Request, ctx: HandlerContext) => {
  const { user, adminClient, body } = ctx;

  if (!user?.id) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), {
      headers: { "Content-Type": "application/json" },
      status: 401,
    });
  }

  // Extra safety: only allow test emails
  const email = (user as any).email || "";
  if (!email.endsWith("@test-rivvlock.com")) {
    logger.warn("[TEST-ASSIGN-ROLE] Attempt from non-test email:", email);
    return new Response(JSON.stringify({ error: "Not allowed" }), {
      headers: { "Content-Type": "application/json" },
      status: 403,
    });
  }

  // Upsert role using service role (bypasses RLS safely)
  const { error } = await adminClient
    .from("user_roles")
    .upsert({ user_id: user.id, role: body.role }, { onConflict: "user_id,role" });

  if (error) {
    logger.error("[TEST-ASSIGN-ROLE] Upsert error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }

  return successResponse({ success: true, user_id: user.id, role: body.role });
};

Deno.serve(
  compose(
    withCors,
    withAuth, // require auth so we can safely read user id/email
    withRateLimit({ maxRequests: 50, windowMs: 60_000 }),
    withValidation(assignRoleSchema)
  )(handler)
);
