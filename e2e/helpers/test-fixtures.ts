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
  const primaryDomain = process.env.E2E_TEST_EMAIL_DOMAIN || 'gmail.com';
  const buildEmail = (domain: string) => `${cleanPrefix}-${timestamp}@${domain}`;
  const password = 'Test123!@#$%';

  let email = buildEmail(primaryDomain);
  let userId: string | null = null;

  console.log('[E2E] createTestUser start:', { role, primaryDomain, firstEmail: email });

  // Try multiple domains as fallback (prefer stable public domains first)
  const candidateDomains = Array.from(new Set([
    primaryDomain,
    'gmail.com',
    'outlook.com',
    'test-rivvlock.com',
    'example.org',
  ]));
  let lastError: any = null;

  for (const domain of candidateDomains) {
    email = buildEmail(domain);
    console.log('[E2E] trying domain:', domain, 'email:', email);

    // Retry a few times to avoid transient 4xx/5xx from edge function / rate limit
    for (let attempt = 1; attempt <= 3; attempt++) {
      const { data, error } = await supabase.functions.invoke('test-create-user', {
        body: { email, password, role: role === 'admin' ? 'admin' : undefined },
      });

      if (!error && data?.user_id) {
        userId = data.user_id;
        console.log('[E2E] user created:', userId, 'email:', email);
        break;
      }

      lastError = error || new Error('invoke failed');
      console.warn(`[E2E] create-user error domain=${domain} attempt=${attempt}:`, error?.message);
      await new Promise((r) => setTimeout(r, 400 * attempt));
    }

    if (userId) break;
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
  const { data: sessionNow } = await supabase.auth.getSession();
  const jwt = sessionNow.session?.access_token;

  let tx: any | null = null;
  let lastInvokeErr: any = null;

  // 1) Preferred path: test helper edge function (bypasses RLS safely) with retries
  try {
    for (let attempt = 1; attempt <= 3 && !tx; attempt++) {
      const { data: createData, error: createErr } = await supabase.functions.invoke('test-create-transaction', {
        body: {
          seller_id: sellerId,
          amount,
          fee_ratio_client: feeRatioClient,
        }
      });

      if (createErr) {
        lastInvokeErr = createErr;
        console.warn(`[E2E] test-create-transaction attempt=${attempt} failed:`, createErr.message);
        await new Promise((r) => setTimeout(r, 400 * attempt));
      } else {
        tx = createData?.transaction ?? null;
      }
    }
  } catch (err) {
    lastInvokeErr = err;
  }

  // 2) Fallback: direct DB insert (same logic as the edge function)
  if (!tx) {
    // Generate secure token via RPC
    const { data: tokenData, error: tokenErr } = await supabase.rpc('generate_secure_token');
    if (tokenErr) {
      console.error('[E2E] token generation error:', tokenErr, '\ninvokeErr:', lastInvokeErr);
      throw new Error(`Failed to create transaction (token): ${tokenErr.message}`);
    }
    const shareToken = tokenData as string;
    const paymentDeadline = new Date(new Date(serviceDate).getTime() - 24 * 60 * 60 * 1000).toISOString();
    const validationDeadline = new Date(new Date(serviceDate).getTime() + 48 * 60 * 60 * 1000).toISOString();
    const shareExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_name, first_name, last_name')
      .eq('user_id', sellerId)
      .maybeSingle();
    const sellerDisplayName = profile?.company_name || `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim() || 'Vendeur';

    const { data: inserted, error: insErr } = await supabase
      .from('transactions')
      .insert({
        user_id: sellerId,
        title: 'E2E Transaction',
        description: 'Test transaction for E2E tests',
        price: amount,
        currency: 'CHF',
        service_date: serviceDate,
        service_end_date: null,
        payment_deadline: paymentDeadline,
        validation_deadline: validationDeadline,
        status: 'pending',
        seller_display_name: sellerDisplayName,
        buyer_display_name: null,
        client_email: null,
        fee_ratio_client: feeRatioClient,
        shared_link_token: shareToken,
        shared_link_expires_at: shareExpiresAt,
      })
      .select()
      .maybeSingle();

    if (insErr || !inserted?.id) {
      console.error('[E2E] direct insert error:', insErr, '\ninvokeErr:', lastInvokeErr);
      throw new Error(`Failed to create transaction (insert): ${insErr?.message || 'unknown'}`);
    }

    tx = inserted;
  }

  if (!tx?.id) throw new Error('No transaction returned from edge function or fallback');


  // 2) Attach buyer via test function (no auth needed)
  if (buyerId && tx) {
    const { error: joinErr } = await supabase.functions.invoke('test-join-transaction', {
      body: { transaction_id: tx.id, token: tx.shared_link_token, buyer_id: buyerId }
    });
    if (joinErr) throw new Error(`Failed to attach buyer: ${joinErr.message}`);
  }

// 3) Mark as paid via test function (bypasses RLS safely)
  if (status !== 'pending' || paymentIntentId) {
    const { error: markErr } = await supabase.functions.invoke('test-mark-transaction-paid', {
      body: {
        transaction_id: tx.id,
        payment_intent_id: paymentIntentId || undefined,
        status: status as 'paid' | 'completed',
      }
    });
    if (markErr) throw new Error(`Failed to mark paid: ${markErr.message}`);
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

  // Click and wait for either user or admin dashboard
  const nav = Promise.race([
    page.waitForURL('**/dashboard/admin**', { timeout: 15000 }),
    page.waitForURL('**/dashboard**', { timeout: 15000 }),
  ]);
  await Promise.all([
    nav,
    page.getByRole('button', { name: /connexion|sign in/i }).click(),
  ]);

  // If not on admin URL yet, try direct navigation (role may be set just-in-time)
  if (!page.url().includes('/dashboard/admin')) {
    await page.goto('/dashboard/admin');
  }

  // Final guard: wait for an admin-only UI signal
  await page.waitForSelector('a[href="/dashboard/admin/disputes"], [data-testid="admin-dispute-card"]', { timeout: 15000 });
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

  // Ensure payment_blocked_at and validation_deadline via edge function
  const { error: blockErr } = await supabase.functions.invoke('test-mark-transaction-paid', {
    body: {
      transaction_id: transaction.id,
      set_blocked_now: true,
      validation_hours: 72,
    }
  });
  if (blockErr) throw new Error(`Failed to set validation deadline: ${blockErr.message}`);
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
  // Create dispute via public test function (bypasses RLS + ensures conversation)
  const { data, error } = await supabase.functions.invoke('test-create-dispute', {
    body: {
      transaction_id: transactionId,
      reporter_id: buyerId,
      reason,
    }
  });

  if (error) throw new Error(`Failed to create dispute: ${error.message}`);

  return { id: data?.disputeId as string };
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
