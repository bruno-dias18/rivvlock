import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { logger } from "../_shared/production-logger.ts";
import { 
  compose,
  withCors, 
  successResponse, 
  errorResponse
} from "../_shared/middleware.ts";

// Public endpoint for cron job
async function handler(req: Request) {
  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    logger.info("Starting cleanup of old webhook events");

    // Call the database function to cleanup old events
    const { error } = await adminClient.rpc('cleanup_old_webhook_events');

    if (error) {
      logger.error("Error cleaning up webhook events", error);
      throw error;
    }

    logger.info("Webhook events cleanup completed");
    return successResponse({ 
      success: true, 
      message: "Old webhook events cleaned up successfully" 
    });
  } catch (error) {
    logger.error("Webhook cleanup error", error);
    return errorResponse(
      error instanceof Error ? error.message : String(error),
      500
    );
  }
}

const composedHandler = compose(withCors)(handler);
Deno.serve(composedHandler);
