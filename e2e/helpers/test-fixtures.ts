import { Page, expect } from '@playwright/test';
import { supabase } from '../../src/integrations/supabase/client';

/**
 * Test fixtures and helper functions for E2E tests
 * Provides reusable setup for creating test data
 */

// Keep a map of credentials per created user id to switch sessions respecting RLS
const userCredentials = new Map<string, { email: string; password: string }>();

export interface TestUser {
  id: string;
  email: string;
  password: string;
  role: 'buyer' | 'seller' | 'admin';
}

export interface TestTransaction {
  id: string;
  token: string;
  amount: number;
  status: string;
}

/** Switch Supabase session to the given user */
export async function signInAs(userId: string) {
  const creds = userCredentials.get(userId);
  if (!creds) throw new Error(`Missing credentials for user ${userId}`);
  await supabase.auth.signOut();
  const { error } = await supabase.auth.signInWithPassword({ email: creds.email, password: creds.password });
  if (error) throw new Error(`Failed to sign in as user ${userId}: ${error.message}`);
}

/**
 * Creates a test user with Stripe account (for sellers)
 */
export async function createTestUser(
  role: 'buyer' | 'seller' | 'admin',
  emailPrefix: string
): Promise<TestUser> {
  const timestamp = Date.now();
  const primaryDomain = process.env.E2E_TEST_EMAIL_DOMAIN || 'test-rivvlock.com';
  const cleanPrefix = emailPrefix.toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 30);
  const buildEmail = (domain: string) => `${cleanPrefix}-${timestamp}@${domain}`;
  const password = 'Test123!@#$%';

  let email = buildEmail(primaryDomain);
  let userId: string | null = null;

  console.log('[E2E] createTestUser start:', { role, primaryDomain, firstEmail: email });

  // Try multiple domains as fallback
  const candidateDomains = [primaryDomain, 'gmail.com', 'outlook.com', 'example.org', 'example.com'];
  let lastError: any = null;

  for (const domain of candidateDomains) {
    email = buildEmail(domain);
    console.log('[E2E] trying domain:', domain, 'email:', email);
    const { data, error } = await supabase.functions.invoke('test-create-user', {
      body: { email, password, role: role === 'admin' ? 'admin' : undefined },
    });
    if (!error && data?.user_id) {
      userId = data.user_id;
      console.log('[E2E] user created:', userId, 'email:', email);
      break;
    }
    console.warn('[E2E] create-user error for', domain, ':', error?.message);
    lastError = error;
  }

  if (!userId) throw new Error(`Failed to create test user: ${lastError?.message || 'unknown error'}`);

  // Sign in to get JWT token
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`Sign-in failed: ${signInError.message}`);

  // Get session token for Authorization header
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  // Assign admin role is handled by test-create-user edge function
  if (role === 'admin') {
    console.log('[E2E] admin role assigned by test-create-user');
  }

  // Store credentials for later session switches
  userCredentials.set(userId, { email, password });

  return {
    id: userId,
    email,
    password,
    role,
  };
}

/**
 * Creates a test transaction between buyer and seller
 */
export async function createTestTransaction(
  sellerId: string,
  buyerId: string | null,
  options: {
    amount: number;
    status?: 'pending' | 'paid' | 'completed' | 'expired';
    paymentIntentId?: string;
    feeRatioClient?: number;
  }
): Promise<TestTransaction> {
  const { amount, status = 'pending', paymentIntentId, feeRatioClient = 0 } = options;

  // 1) Seller session
  await signInAs(sellerId);

  // Create via edge function to ensure secure token and defaults
  const serviceDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: createData, error: createErr } = await supabase.functions.invoke('create-transaction', {
    body: {
      title: 'E2E Transaction',
      description: 'Test transaction for E2E tests',
      price: amount,
      currency: 'CHF',
      service_date: serviceDate,
      service_end_date: null,
      client_email: null,
      client_name: null,
      buyer_display_name: null,
      fee_ratio_client: feeRatioClient,
    },
  });
  if (createErr) throw new Error(`Failed to create transaction (edge): ${createErr.message}`);
  const tx = createData?.transaction;
  if (!tx?.id) throw new Error('No transaction returned from edge function');

  // 2) Attach buyer if provided using security definer RPC
  if (buyerId) {
    await signInAs(buyerId);
    const { error: joinErr } = await supabase.rpc('assign_self_as_buyer', {
      p_transaction_id: tx.id,
      p_token: tx.shared_link_token,
    });
    if (joinErr) throw new Error(`Failed to attach buyer: ${joinErr.message}`);
  }

  // 3) Back to seller, set status/intent if needed
  await signInAs(sellerId);
  if (status !== 'pending' || paymentIntentId) {
    const { error: updErr } = await supabase
      .from('transactions')
      .update({
        status,
        stripe_payment_intent_id: paymentIntentId || null,
      })
      .eq('id', tx.id);
    if (updErr) throw new Error(`Failed to update transaction: ${updErr.message}`);
  }

  return {
    id: tx.id,
    token: tx.shared_link_token,
    amount: tx.price,
    status: status,
  };
}

/**
 * Logs in a user via UI
 */
export async function loginUser(page: Page, user: TestUser) {
  await page.goto('/auth');
  await page.getByLabel(/email/i).fill(user.email);
  await page.getByLabel(/mot de passe|password/i).fill(user.password);
  
  // Click and wait for navigation in parallel
  await Promise.all([
    page.waitForURL('**/dashboard**', { timeout: 15000 }),
    page.getByRole('button', { name: /connexion|sign in/i }).click(),
  ]);
}

/**
 * Logs in an admin user and waits for admin dashboard
 */
export async function loginAdmin(page: Page, user: TestUser) {
  await page.goto('/auth');
  await page.getByLabel(/email/i).fill(user.email);
  await page.getByLabel(/mot de passe|password/i).fill(user.password);
  
  // Click and wait for navigation in parallel
  await Promise.all([
    page.waitForURL('**/dashboard/admin**', { timeout: 15000 }),
    page.getByRole('button', { name: /connexion|sign in/i }).click(),
  ]);
}

/**
 * Creates a paid transaction ready for validation
 */
export async function createPaidTransaction(
  sellerId: string,
  buyerId: string,
  amount: number
): Promise<TestTransaction> {
  const transaction = await createTestTransaction(sellerId, buyerId, {
    amount,
    status: 'paid',
    paymentIntentId: `pi_test_${Date.now()}`,
  });

  // Set payment_blocked_at and validation_deadline (72h)
  const paymentBlockedAt = new Date();
  const validationDeadline = new Date(paymentBlockedAt.getTime() + 72 * 60 * 60 * 1000);

  await supabase
    .from('transactions')
    .update({
      payment_blocked_at: paymentBlockedAt.toISOString(),
      validation_deadline: validationDeadline.toISOString(),
    })
    .eq('id', transaction.id);

  return transaction;
}

/**
 * Marks transaction as completed by seller
 */
export async function markTransactionCompleted(transactionId: string, sellerId: string) {
  await signInAs(sellerId);
  await supabase
    .from('transactions')
    .update({
      seller_validated: true,
    })
    .eq('id', transactionId);
}

/**
 * Force a transaction to be expired by setting a past deadline
 */
export async function expireTransaction(transactionId: string, sellerId: string) {
  await signInAs(sellerId);
  const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  await supabase
    .from('transactions')
    .update({ payment_deadline: past })
    .eq('id', transactionId);
}
/**
 * Creates a dispute on a transaction
 */
export async function createTestDispute(
  transactionId: string,
  buyerId: string,
  reason: string = 'quality_issue'
) {
  const { data, error } = await supabase
    .from('disputes')
    .insert({
      transaction_id: transactionId,
      created_by: buyerId,
      reason,
      description: 'Test dispute for E2E tests',
      status: 'open',
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create dispute: ${error.message}`);
  return data;
}

/**
 * Cleans up test data after test completion
 */
export async function cleanupTestData(testUserIds: string[]) {
  // Delete user roles first (FK constraint)
  await supabase.from('user_roles').delete().in('user_id', testUserIds);
  
  // Delete conversations
  await supabase.from('conversations').delete().in('seller_id', testUserIds);
  await supabase.from('conversations').delete().in('buyer_id', testUserIds);
  
  // Delete disputes via transactions
  const { data: transactions } = await supabase
    .from('transactions')
    .select('id')
    .or(`seller_id.in.(${testUserIds.join(',')}),buyer_id.in.(${testUserIds.join(',')})`);
  
  if (transactions) {
    const transactionIds = transactions.map(t => t.id);
    await supabase.from('disputes').delete().in('transaction_id', transactionIds);
  }
  
  // Delete transactions
  await supabase.from('transactions').delete().in('user_id', testUserIds);
  await supabase.from('transactions').delete().in('buyer_id', testUserIds);

  // Delete profiles (will cascade to user_roles via FK)
  await supabase.from('profiles').delete().in('user_id', testUserIds);

  // Note: Auth users deletion requires service role in edge function
}
