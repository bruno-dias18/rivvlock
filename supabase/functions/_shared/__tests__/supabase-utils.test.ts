import { assertExists } from 'https://deno.land/std@0.192.0/testing/asserts.ts';
import { createServiceClient } from '../supabase-utils.ts';

Deno.test('createServiceClient - should create client with service role', () => {
  const client = createServiceClient();
  assertExists(client);
  // Verify it's a Supabase client
  assertExists(client.auth);
  assertExists(client.from);
});
