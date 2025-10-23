import { Page } from '@playwright/test';
import { supabase } from '../../src/integrations/supabase/client';

/**
 * Test fixtures and helper functions for E2E tests
 * Provides reusable setup for creating test data
 */

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

/**
 * Creates a test user with Stripe account (for sellers)
 */
export async function createTestUser(
  role: 'buyer' | 'seller' | 'admin',
  emailPrefix: string
): Promise<TestUser> {
  const timestamp = Date.now();
  const email = `${emailPrefix}-${timestamp}@test-rivvlock.com`;
  const password = 'Test123!@#$%';

  // Create auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (authError) throw new Error(`Failed to create test user: ${authError.message}`);
  if (!authData.user) throw new Error('No user data returned');

  // Ensure we have a session for edge function auth
  await supabase.auth.signInWithPassword({ email, password });

  // Assign role via secure edge function (service role), restricted to @test-rivvlock.com
  if (role === 'admin') {
    const { error: roleError } = await supabase.functions.invoke('test-assign-role', {
      body: { role: 'admin' },
    });

    if (roleError) throw new Error(`Failed to set admin role: ${roleError.message}`);
  }

  return {
    id: authData.user.id,
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

  // Calculate deadlines
  const now = new Date();
  const serviceDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // +7 days
  const paymentDeadline = new Date(serviceDate.getTime() - 24 * 60 * 60 * 1000); // -24h before service

  const { data, error } = await supabase
    .from('transactions')
    .insert({
      seller_id: sellerId,
      buyer_id: buyerId,
      amount,
      currency: 'CHF',
      status,
      service_date: serviceDate.toISOString(),
      payment_deadline: paymentDeadline.toISOString(),
      payment_intent_id: paymentIntentId || null,
      fee_ratio_client: feeRatioClient,
      description: 'Test transaction for E2E tests',
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create transaction: ${error.message}`);

  return {
    id: data.id,
    token: data.token,
    amount: data.amount,
    status: data.status,
  };
}

/**
 * Logs in a user via UI
 */
export async function loginUser(page: Page, user: TestUser) {
  await page.goto('/auth');
  await page.getByLabel(/email/i).fill(user.email);
  await page.getByLabel(/mot de passe|password/i).fill(user.password);
  await page.getByRole('button', { name: /connexion|sign in/i }).click();
  await page.waitForURL('/dashboard', { timeout: 10000 });
}

/**
 * Logs in an admin user and waits for admin dashboard
 */
export async function loginAdmin(page: Page, user: TestUser) {
  await page.goto('/auth');
  await page.getByLabel(/email/i).fill(user.email);
  await page.getByLabel(/mot de passe|password/i).fill(user.password);
  await page.getByRole('button', { name: /connexion|sign in/i }).click();
  
  // Admin users are redirected to /dashboard/admin
  await page.waitForURL('/dashboard/admin', { timeout: 10000 });
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
export async function markTransactionCompleted(transactionId: string) {
  await supabase
    .from('transactions')
    .update({
      seller_completed_at: new Date().toISOString(),
      status: 'awaiting_validation',
    })
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
  await supabase.from('transactions').delete().in('seller_id', testUserIds);
  await supabase.from('transactions').delete().in('buyer_id', testUserIds);

  // Delete profiles (will cascade to user_roles via FK)
  await supabase.from('profiles').delete().in('user_id', testUserIds);

  // Note: Auth users deletion requires service role in edge function
}
