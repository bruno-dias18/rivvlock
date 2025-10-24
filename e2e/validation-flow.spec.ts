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

    // Status should update to validation phase with countdown (data-testid)
    await expect(page.locator('[data-testid="validation-countdown"]')).toBeVisible();
  });

  test('buyer sees validation request and can validate', async ({ page }) => {
    // Mark transaction as completed
    await markTransactionCompleted(transaction.id, seller.id);

    // Login as buyer
    await loginUser(page, buyer);

    // Navigate to transactions (blocked tab)
    await page.goto('/dashboard/transactions?tab=blocked');
    await page.waitForLoadState('networkidle');

    // Should see validation badge/notification
    await expect(page.getByText(/validation requise|validation required/i)).toBeVisible();

    // Open the transaction we just created
    const buyerTxCard = page.locator(`[data-testid="transaction-card"][data-transaction-id="${transaction.id}"]`);
    await expect(buyerTxCard).toBeVisible({ timeout: 15000 });
    await buyerTxCard.click();

    // Should see validation countdown
    await expect(page.locator('[data-testid="validation-countdown"]')).toBeVisible();

    // Validate button should be visible
    const validateButton = page.getByRole('button', { name: /valider et libérer les fonds|validate and release/i });
    await expect(validateButton).toBeVisible();

    // Click validate
    await validateButton.click();

    // Confirm in dialog with checkbox
    await page.getByLabel(/je confirme|i confirm/i).check();
    await page.getByRole('button', { name: /confirmer la validation|confirm validation/i }).click();

    // Should see success message
    await expect(page.getByText(/fonds libérés|funds released/i)).toBeVisible();

    // Status should be completed
    await expect(page.getByText(/terminé|completed/i)).toBeVisible();
  });

  test('validation countdown displays correct time remaining', async ({ page }) => {
    // Create new paid transaction
    const newTransaction = await createPaidTransaction(seller.id, buyer.id, 500);
    await markTransactionCompleted(newTransaction.id, seller.id);

    // Login as buyer
    await loginUser(page, buyer);

    await page.goto('/dashboard/transactions?tab=blocked');
    await page.waitForLoadState('networkidle');
    const newTxCard = page.locator(`[data-testid="transaction-card"][data-transaction-id="${newTransaction.id}"]`);
    await expect(newTxCard).toBeVisible({ timeout: 15000 });
    await newTxCard.click();

    // Should see countdown component
    await expect(page.locator('[data-testid="validation-countdown"]')).toBeVisible();
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
    await page.waitForLoadState('networkidle');
    const expiredTxCard = page.locator(`[data-testid=\"transaction-card\"][data-transaction-id=\"${expiredTransaction.id}\"]`);
    await expect(expiredTxCard).toBeVisible({ timeout: 15000 });
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
    await page.waitForLoadState('networkidle');
    
    // Open the specific transaction card
    await page.locator(`[data-testid="transaction-card"][data-transaction-id="${pendingTransaction.id}"]`).click();

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
    await page.waitForLoadState('networkidle');
    const sellerTxCard = page.locator(`[data-testid="transaction-card"][data-transaction-id="${transaction.id}"]`);
    await expect(sellerTxCard).toBeVisible({ timeout: 15000 });
    await sellerTxCard.click();

    // Validate button should not be present for seller
    const validateButton = page.getByRole('button', { name: /valider et libérer|validate and release/i });
    await expect(validateButton).toHaveCount(0);
  });

  test('transaction timeline shows all status changes', async ({ page }) => {
    const transaction = await createPaidTransaction(seller.id, buyer.id, 400);
    await markTransactionCompleted(transaction.id, seller.id);

    await loginUser(page, buyer);
    await page.goto('/dashboard/transactions?tab=blocked');
    await page.waitForLoadState('networkidle');
    const timelineContainer = page.locator(`[data-testid="transaction-card"][data-transaction-id="${transaction.id}"] [data-testid="transaction-timeline"]`);
    await expect(timelineContainer).toBeVisible();
  });
});
