import { assertEquals, assertExists } from 'https://deno.land/std@0.192.0/testing/asserts.ts';
import { createServiceClient, createAnonClient, createAuthenticatedClient } from '../supabase-utils.ts';

Deno.test('createServiceClient - should create client with service role', () => {
  const client = createServiceClient();
  assertExists(client);
  // Verify it's a Supabase client
  assertExists(client.auth);
  assertExists(client.from);
});

Deno.test('createAnonClient - should create client with anon key', () => {
  const client = createAnonClient();
  assertExists(client);
  assertExists(client.auth);
  assertExists(client.from);
});

Deno.test('createAuthenticatedClient - should throw error without auth header', () => {
  let error;
  try {
    createAuthenticatedClient(null);
  } catch (e) {
    error = e;
  }
  assertExists(error);
  assertEquals(error.message, 'Missing authorization header');
});

Deno.test('createAuthenticatedClient - should create client with valid header', () => {
  const authHeader = 'Bearer test-token';
  const client = createAuthenticatedClient(authHeader);
  assertExists(client);
  assertExists(client.auth);
});
