import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { logger } from "./logger.ts";
import { checkRateLimit, getClientIp } from "./rate-limiter.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export type Handler = (req: Request, ctx: HandlerContext) => Promise<Response>;

export interface HandlerContext {
  user?: { id: string; email?: string };
  supabaseClient?: any;
  adminClient?: any;
  body?: any;
}

/**
 * CORS Middleware - Handles OPTIONS requests and adds CORS headers
 */
export function withCors(handler: Handler): Handler {
  return async (req: Request, ctx: HandlerContext): Promise<Response> => {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const response = await handler(req, ctx);
      
      // Add CORS headers to response
      const headers = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        headers.set(key, value);
      });
      
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return new Response(JSON.stringify({ error: errorMessage }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }
  };
}

/**
 * Auth Middleware - Extracts and verifies JWT token
 */
export function withAuth(handler: Handler): Handler {
  return async (req: Request, ctx: HandlerContext): Promise<Response> => {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    // User client: uses ANON_KEY with user's JWT for authentication
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false },
      }
    );

    // Admin client: uses SERVICE_ROLE_KEY to bypass RLS for authorized operations
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { data: userData, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !userData.user?.id) {
      return new Response(JSON.stringify({ error: "User not authenticated" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    ctx.user = userData.user;
    ctx.supabaseClient = supabaseClient;
    ctx.adminClient = adminClient;

    return handler(req, ctx);
  };
}

/**
 * Rate Limiting Middleware
 */
export interface RateLimitOptions {
  maxRequests?: number;
  windowMs?: number;
}

export function withRateLimit(options: RateLimitOptions = {}): (handler: Handler) => Handler {
  return (handler: Handler): Handler => {
    return async (req: Request, ctx: HandlerContext): Promise<Response> => {
      const clientIp = getClientIp(req);
      
      try {
        await checkRateLimit(clientIp);
        if (ctx.user?.id) {
          await checkRateLimit(clientIp, ctx.user.id);
        }
      } catch (error) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 429,
        });
      }

      return handler(req, ctx);
    };
  };
}

/**
 * Validation Middleware - Validates request body against Zod schema
 */
export function withValidation<T extends z.ZodType>(schema: T): (handler: Handler) => Handler {
  return (handler: Handler): Handler => {
    return async (req: Request, ctx: HandlerContext): Promise<Response> => {
      try {
        const body = await req.json();
        logger.log('[VALIDATION] Body received:', JSON.stringify(body, null, 2));
        const validatedData = schema.parse(body);
        logger.log('[VALIDATION] ✅ Validation passed');
        ctx.body = validatedData;
      } catch (error) {
        if (error instanceof z.ZodError) {
          logger.error('[VALIDATION] ❌ Validation failed:', JSON.stringify(error.errors, null, 2));
          return new Response(
            JSON.stringify({ 
              error: "Validation failed", 
              details: error.errors 
            }), 
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 400,
            }
          );
        }
        logger.error('[VALIDATION] ❌ Invalid request body:', error);
        return new Response(JSON.stringify({ error: "Invalid request body" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }

      return handler(req, ctx);
    };
  };
}

/**
 * Compose multiple middlewares into a single handler
 */
export function compose(...middlewares: Array<(handler: Handler) => Handler>): (handler: Handler) => Handler {
  return (handler: Handler): Handler => {
    return middlewares.reduceRight((acc, middleware) => middleware(acc), handler);
  };
}

// Re-export response helpers from response-helpers.ts for convenience
export { 
  successResponse, 
  errorResponse,
  corsPreflightResponse,
  validationErrorResponse,
  unauthorizedResponse,
  notFoundResponse,
  rateLimitResponse,
  extractErrorMessage,
  getCorsHeaders
} from "./response-helpers.ts";
