/**
 * Response Helper Functions for Edge Functions
 * 
 * Provides consistent response formatting and error handling
 * across all edge functions
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Create success response with CORS headers
 */
export function successResponse<T>(data: T, status: number = 200): Response {
  const payload = (data !== null && typeof data === 'object')
    ? { success: true, ...(data as any) }
    : { success: true, data };
  return new Response(JSON.stringify(payload), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

/**
 * Create error response with CORS headers
 */
export function errorResponse(
  message: string,
  status: number = 400,
  details?: Record<string, any>
): Response {
  return new Response(
    JSON.stringify({
      error: message,
      ...details,
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status,
    }
  );
}

/**
 * Handle CORS preflight requests
 */
export function corsPreflightResponse(): Response {
  return new Response(null, { headers: corsHeaders });
}

/**
 * Validation error response
 */
export function validationErrorResponse(errors: Record<string, string>): Response {
  return errorResponse("Validation failed", 422, { errors });
}

/**
 * Unauthorized error response
 */
export function unauthorizedResponse(message: string = "Unauthorized"): Response {
  return errorResponse(message, 401);
}

/**
 * Not found error response
 */
export function notFoundResponse(resource: string = "Resource"): Response {
  return errorResponse(`${resource} not found`, 404);
}

/**
 * Rate limit error response
 */
export function rateLimitResponse(): Response {
  return errorResponse("Rate limit exceeded", 429, {
    retryAfter: 60,
  });
}

/**
 * Extract error message from unknown error
 */
export function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unknown error occurred';
}

/**
 * Get CORS headers
 */
export function getCorsHeaders(): Record<string, string> {
  return corsHeaders;
}
