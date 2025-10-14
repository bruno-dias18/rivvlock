/**
 * Integration test setup for edge functions and database
 * 
 * This file provides utilities for testing Supabase edge functions
 * and database operations in a safe, isolated environment.
 */

import { createClient } from '@supabase/supabase-js';

// Test Supabase client (uses anon key for safety)
export const testSupabaseClient = createClient(
  import.meta.env.VITE_SUPABASE_URL || '',
  import.meta.env.VITE_SUPABASE_ANON_KEY || ''
);

/**
 * Helper to invoke edge functions in tests
 */
export async function invokeEdgeFunction(
  functionName: string,
  payload: Record<string, any>,
  authToken?: string
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const { data, error } = await testSupabaseClient.functions.invoke(
    functionName,
    {
      body: payload,
      headers,
    }
  );

  return { data, error };
}

/**
 * Mock Stripe responses for testing
 */
export const mockStripeResponses = {
  paymentIntent: {
    id: 'pi_test_123',
    status: 'requires_capture',
    amount: 10000,
    currency: 'eur',
  },
  customer: {
    id: 'cus_test_123',
    email: 'test@example.com',
  },
  transfer: {
    id: 'tr_test_123',
    amount: 9500,
    currency: 'eur',
  },
};

/**
 * Test data generators
 */
export const testData = {
  transaction: {
    title: 'Test Transaction',
    description: 'Test description',
    price: 100,
    currency: 'EUR' as const,
    service_date: new Date().toISOString(),
  },
  dispute: {
    dispute_type: 'quality_issue',
    reason: 'Test dispute reason',
  },
  profile: {
    first_name: 'Test',
    last_name: 'User',
    user_type: 'particular' as const,
    country: 'FR' as const,
  },
};
