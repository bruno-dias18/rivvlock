import { corsHeaders } from '../_shared/response-helpers.ts';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const checks: Record<string, any> = {};

  try {
    // 1. Check Supabase (simple ping)
    const supabaseStart = Date.now();
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
        method: 'HEAD',
        headers: {
          'apikey': Deno.env.get('SUPABASE_ANON_KEY') || '',
        },
      });
      checks.supabase = {
        status: response.ok ? 'operational' : 'degraded',
        latency_ms: Date.now() - supabaseStart,
        message: response.ok ? 'Supabase API is healthy' : 'Supabase API returned non-200',
      };
    } catch (error) {
      checks.supabase = {
        status: 'down',
        latency_ms: Date.now() - supabaseStart,
        message: `Supabase unreachable: ${error.message}`,
      };
    }

    // 2. Check Stripe
    const stripeStart = Date.now();
    try {
      const response = await fetch('https://api.stripe.com/v1/balance', {
        headers: {
          'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        },
      });
      checks.stripe = {
        status: response.ok ? 'operational' : 'degraded',
        latency_ms: Date.now() - stripeStart,
        message: response.ok ? 'Stripe API is healthy' : 'Stripe API returned non-200',
      };
    } catch (error) {
      checks.stripe = {
        status: 'down',
        latency_ms: Date.now() - stripeStart,
        message: `Stripe unreachable: ${error.message}`,
      };
    }

    // Overall status
    const allOperational = Object.values(checks).every((c: any) => c.status === 'operational');
    const anyDown = Object.values(checks).every((c: any) => c.status === 'down');

    return new Response(
      JSON.stringify({
        status: anyDown ? 'down' : allOperational ? 'operational' : 'degraded',
        timestamp: new Date().toISOString(),
        response_time_ms: Date.now() - startTime,
        checks,
        version: '1.0.0',
      }),
      {
        status: allOperational ? 200 : 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        status: 'error',
        message: error.message,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
