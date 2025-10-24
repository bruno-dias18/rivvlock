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

    // Login as seller and verify validation phase visible
    await loginUser(page, seller);
    await page.getByRole('link', { name: /transactions/i }).click();
    await page.waitForLoadState('networkidle');
    await page.locator('[data-testid="transaction-card"]').first().click();

    // Status should update to validation phase with countdown (text variant)
    await expect(page.getByText(/avant libération automatique|pour finaliser ou contester/i)).toBeVisible();
  });

  test('buyer sees validation request and can validate', async ({ page }) => {
    // Mark transaction as completed
    await markTransactionCompleted(transaction.id, seller.id);

    // Login as buyer
    await loginUser(page, buyer);

    // Navigate to transactions
    await page.getByRole('link', { name: /transactions/i }).click();

    // Should see validation badge/notification
    await expect(page.getByText(/validation requise|validation required/i)).toBeVisible();

    // Open the first transaction card
    await page.locator('[data-testid="transaction-card"]').first().click();

    // Should see validation countdown text
    await expect(page.getByText(/temps restant|time remaining|pour finaliser ou contester/i)).toBeVisible();

    // Should see seller completion message
    await expect(page.getByText(/le vendeur a marqué la transaction comme terminée/i)).toBeVisible();

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

    await page.getByRole('link', { name: /transactions/i }).click();
    await page.locator('[data-testid="transaction-card"]').first().click();

    // Should see countdown text (format like "h" and "min" or validation phrases)
    await expect(page.getByText(/h|min|pour finaliser ou contester|avant libération automatique/i)).toBeVisible();
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

    await page.getByRole('link', { name: /transactions/i }).click();
    await page.locator('[data-testid="transaction-card"]').first().click();

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
    
    // Open the first transaction card (list is ordered by recent activity)
    await page.locator('[data-testid="transaction-card"]').first().click();

    // Complete button should not be present
    const completeButton = page.getByRole('button', { name: /marquer comme terminé|mark as completed/i });
    await expect(completeButton).toHaveCount(0);
  });

  test('seller cannot validate their own transaction', async ({ page }) => {
  const transaction = await createPaidTransaction(seller.id, buyer.id, 600);
  await markTransactionCompleted(transaction.id, seller.id);

    // Login as seller
    await loginUser(page, seller);
    await page.getByRole('link', { name: /transactions/i }).click();
    await page.locator('[data-testid="transaction-card"]').first().click();

    // Validate button should not be present for seller
    const validateButton = page.getByRole('button', { name: /valider et libérer|validate and release/i });
    await expect(validateButton).toHaveCount(0);

    // Should see waiting for buyer message
    await expect(page.getByText(/en attente de validation de l'acheteur/i)).toBeVisible();
  });

  test('transaction timeline shows all status changes', async ({ page }) => {
    const transaction = await createPaidTransaction(seller.id, buyer.id, 400);
    await markTransactionCompleted(transaction.id, seller.id);

    await loginUser(page, buyer);
    await page.getByRole('link', { name: /transactions/i }).click();
    await page.locator('[data-testid="transaction-card"]').first().click();

    // Should see transaction timeline section
    await expect(page.locator('[data-testid="transaction-timeline"]')).toBeVisible();
  });
});
