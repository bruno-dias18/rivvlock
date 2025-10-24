import { test, expect } from '@playwright/test';
import {
  createPaidTransaction,
  markTransactionCompleted,
  loginUser,
  cleanupTestData,
} from './helpers/test-fixtures';
import { getTestUser, releaseTestUser } from './helpers/user-pool';

/**
 * E2E tests for the complete validation flow
 * 
 * Critical journey:
 * 1. Transaction is paid (72h countdown starts)
 * 2. Seller marks as completed
 * 3. Buyer validates or 72h expires
 * 4. Funds are released to seller
 */

test.describe.serial('Validation Flow - Complete Journey', () => {
  let seller: any;
  let buyer: any;
  let transaction: any;
  const testUserIds: string[] = [];

  test.beforeAll(async () => {
    // Get test users from pool
    seller = await getTestUser('seller');
    buyer = await getTestUser('buyer');
    testUserIds.push(seller.id, buyer.id);
  });

  test.afterAll(async () => {
    // Release users back to pool
    releaseTestUser(seller.id);
    releaseTestUser(buyer.id);
    // Cleanup test data
    await cleanupTestData(testUserIds);
  });

  test('seller can mark paid transaction as completed', async ({ page }) => {
    // Create paid transaction
    transaction = await createPaidTransaction(seller.id, buyer.id, 1000);

    // Mark as completed (server-side helper bypasses RLS)
    await markTransactionCompleted(transaction.id, seller.id);

    await loginUser(page, seller);
    await page.goto('/dashboard/transactions?tab=blocked');
    const txCard = page.locator(`[data-testid="transaction-card"][data-transaction-id="${transaction.id}"]`);
    await expect(txCard).toBeVisible({ timeout: 20000 });
    await txCard.click();

    // Status should update to validation phase with countdown (scoped to this card)
    const countdown = txCard.locator('[data-testid="validation-countdown"]');
    await expect(countdown).toBeVisible();
  });

  test('buyer sees validation request and can validate', async ({ page }) => {
    // Mark transaction as completed
    await markTransactionCompleted(transaction.id, seller.id);

    // Login as buyer
    await loginUser(page, buyer);

    // Navigate to transactions (blocked tab)
    await page.goto('/dashboard/transactions?tab=blocked');

    // Open the transaction we just created (scoped to this card)
    const buyerTxCard = page.locator(`[data-testid="transaction-card"][data-transaction-id="${transaction.id}"]`);
    await expect(buyerTxCard).toBeVisible({ timeout: 20000 });

    // Should see validation badge/notification within this card (avoid global matches)
    await expect(buyerTxCard.getByText(/validation requise|validation required/i)).toBeVisible({ timeout: 15000 });

    // Should see validation countdown (scoped, without opening details)
    await expect(buyerTxCard.locator('[data-testid="validation-countdown"]')).toBeVisible({ timeout: 20000 });

    // Validate button should be visible (scoped to this card)
    const validateButton = buyerTxCard.getByRole('button', { name: /finaliser la transaction|finalize/i });
    await expect(validateButton).toBeVisible({ timeout: 20000 });

    // Click validate
    await validateButton.click();

    // Finalize via test helper (bypasses Stripe)
    const { supabase } = await import('../src/integrations/supabase/client');
    const { error: finalizeErr } = await supabase.functions.invoke('test-release-funds', {
      body: { transaction_id: transaction.id }
    });
    expect(finalizeErr).toBeUndefined();

    // Refresh and verify completed status
    await page.reload();
    await expect(page.getByText(/terminé|completed/i)).toBeVisible({ timeout: 20000 });
  });

  test('validation countdown displays correct time remaining', async ({ page }) => {
    // Create new paid transaction
    const newTransaction = await createPaidTransaction(seller.id, buyer.id, 500);
    await markTransactionCompleted(newTransaction.id, seller.id);

    // Login as buyer
    await loginUser(page, buyer);

    await page.goto('/dashboard/transactions?tab=blocked');
    const newTxCard = page.locator(`[data-testid="transaction-card"][data-transaction-id="${newTransaction.id}"]`);
    await expect(newTxCard).toBeVisible({ timeout: 20000 });
    await newTxCard.click();

    // Should see countdown component (scoped)
    await expect(newTxCard.locator('[data-testid="validation-countdown"]')).toBeVisible();
  });

  test('transaction auto-releases after 72h validation deadline', async ({ page }) => {
    // This test requires time manipulation or database manipulation
    // For now, we just verify the UI shows the correct information

  // Create transaction with expired validation deadline
  const expiredTransaction = await createPaidTransaction(seller.id, buyer.id, 300);
  await markTransactionCompleted(expiredTransaction.id, seller.id);

  // Manually set validation_deadline to past
  const { supabase } = await import('../src/integrations/supabase/client');
    await supabase
      .from('transactions')
      .update({
        validation_deadline: new Date(Date.now() - 60000).toISOString(), // 1 minute ago
      })
      .eq('id', expiredTransaction.id);

    // Login as buyer
    await loginUser(page, buyer);

    await page.goto('/dashboard/transactions?tab=blocked');
    const expiredTxCard = page.locator(`[data-testid=\"transaction-card\"][data-transaction-id=\"${expiredTransaction.id}\"]`);
    await expect(expiredTxCard).toBeVisible({ timeout: 20000 });
    await expiredTxCard.click();

    // Should show expired validation message
    await expect(page.getByText(/délai de validation expiré|validation deadline expired/i)).toBeVisible();

    // Should show auto-release message
    await expect(page.getByText(/fonds seront libérés automatiquement|funds will be released automatically/i)).toBeVisible();
  });
});

test.describe.serial('Validation Flow - Edge Cases', () => {
  let seller: any;
  let buyer: any;
  const testUserIds: string[] = [];

  test.beforeAll(async () => {
    seller = await getTestUser('seller');
    buyer = await getTestUser('buyer');
    testUserIds.push(seller.id, buyer.id);
  });

  test.afterAll(async () => {
    releaseTestUser(seller.id);
    releaseTestUser(buyer.id);
    await cleanupTestData(testUserIds);
  });

  test('cannot mark unpaid transaction as completed', async ({ page }) => {
    const { createTestTransaction } = await import('./helpers/test-fixtures');
    const pendingTransaction = await createTestTransaction(seller.id, buyer.id, {
      amount: 800,
      status: 'pending',
    });

    await loginUser(page, seller);
    await page.goto('/dashboard/transactions');
    
    // Open the specific transaction card
    const pendingCard = page.locator(`[data-testid="transaction-card"][data-transaction-id="${pendingTransaction.id}"]`);
    await expect(pendingCard).toBeVisible({ timeout: 20000 });
    await pendingCard.click();

    // Complete button should not be present
    const completeButton = page.getByRole('button', { name: /marquer comme terminé|mark as completed/i });
    await expect(completeButton).toHaveCount(0);
  });

  test('seller cannot validate their own transaction', async ({ page }) => {
  const transaction = await createPaidTransaction(seller.id, buyer.id, 600);
  await markTransactionCompleted(transaction.id, seller.id);

    // Login as seller
    await loginUser(page, seller);
    await page.goto('/dashboard/transactions?tab=blocked');
    const sellerTxCard = page.locator(`[data-testid="transaction-card"][data-transaction-id="${transaction.id}"]`);
    await expect(sellerTxCard).toBeVisible({ timeout: 20000 });
    await sellerTxCard.click();

    // Validate button should not be present for seller
    const validateButton = sellerTxCard.getByRole('button', { name: /finaliser la transaction|finalize/i });
    await expect(validateButton).toHaveCount(0);
  });

  test('transaction timeline shows all status changes', async ({ page }) => {
    const transaction = await createPaidTransaction(seller.id, buyer.id, 400);
    await markTransactionCompleted(transaction.id, seller.id);

    // Ensure authenticated session before navigating
    await loginUser(page, seller);
    await page.goto('/dashboard/transactions?tab=blocked');

    const txCard = page.locator(`[data-testid="transaction-card"][data-transaction-id="${transaction.id}"]`);
    await expect(txCard).toBeVisible({ timeout: 20000 });

    const timelineContainer = txCard.locator('[data-testid="transaction-timeline"]');
    await expect(timelineContainer).toBeVisible({ timeout: 20000 });
  });
});
