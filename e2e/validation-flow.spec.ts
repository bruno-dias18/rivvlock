import { test, expect } from '@playwright/test';
import {
  createTestUser,
  createPaidTransaction,
  markTransactionCompleted,
  loginUser,
  cleanupTestData,
} from './helpers/test-fixtures';

/**
 * E2E tests for the complete validation flow
 * 
 * Critical journey:
 * 1. Transaction is paid (72h countdown starts)
 * 2. Seller marks as completed
 * 3. Buyer validates or 72h expires
 * 4. Funds are released to seller
 */

test.describe('Validation Flow - Complete Journey', () => {
  let seller: any;
  let buyer: any;
  let transaction: any;
  const testUserIds: string[] = [];

  test.beforeAll(async () => {
    // Create test users
    seller = await createTestUser('seller', 'validation-seller');
    buyer = await createTestUser('buyer', 'validation-buyer');
    testUserIds.push(seller.id, buyer.id);
  });

  test.afterAll(async () => {
    // Cleanup test data
    await cleanupTestData(testUserIds);
  });

  test('seller can mark paid transaction as completed', async ({ page }) => {
    // Create paid transaction
    transaction = await createPaidTransaction(seller.id, buyer.id, 1000);

    // Login as seller
    await loginUser(page, seller);

    // Navigate to transactions
    await page.getByRole('link', { name: /transactions/i }).click();

    // Find the test transaction
    await page.getByText(transaction.id.substring(0, 8)).click();

    // Should see "Mark as completed" button
    const completeButton = page.getByRole('button', { name: /marquer comme terminé|mark as completed/i });
    await expect(completeButton).toBeVisible();

    // Mark as completed
    await completeButton.click();

    // Confirm in dialog
    await page.getByRole('button', { name: /confirmer|confirm/i }).click();

    // Should see success message
    await expect(page.getByText(/marqué comme terminé|marked as completed/i)).toBeVisible();

    // Status should update
    await expect(page.getByText(/en attente de validation|awaiting validation/i)).toBeVisible();
  });

  test('buyer sees validation request and can validate', async ({ page }) => {
    // Mark transaction as completed
    await markTransactionCompleted(transaction.id);

    // Login as buyer
    await loginUser(page, buyer);

    // Navigate to transactions
    await page.getByRole('link', { name: /transactions/i }).click();

    // Should see validation badge/notification
    await expect(page.getByText(/validation requise|validation required/i)).toBeVisible();

    // Click on transaction
    await page.getByText(transaction.id.substring(0, 8)).click();

    // Should see validation countdown
    await expect(page.getByText(/temps restant|time remaining/i)).toBeVisible();
    await expect(page.locator('[data-testid="validation-countdown"]')).toBeVisible();

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
    await markTransactionCompleted(newTransaction.id);

    // Login as buyer
    await loginUser(page, buyer);

    await page.getByRole('link', { name: /transactions/i }).click();
    await page.getByText(newTransaction.id.substring(0, 8)).click();

    // Should see countdown timer
    const countdown = page.locator('[data-testid="validation-countdown"]');
    await expect(countdown).toBeVisible();

    // Should contain "72" or "71" hours (freshly created)
    await expect(countdown).toContainText(/7[0-2]/);

    // Should show hours, not days for better granularity
    await expect(countdown).toContainText(/heure|hour/i);
  });

  test('transaction auto-releases after 72h validation deadline', async ({ page }) => {
    // This test requires time manipulation or database manipulation
    // For now, we just verify the UI shows the correct information

    // Create transaction with expired validation deadline
    const expiredTransaction = await createPaidTransaction(seller.id, buyer.id, 300);
    await markTransactionCompleted(expiredTransaction.id);

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
    await page.getByText(expiredTransaction.id.substring(0, 8)).click();

    // Should show expired validation message
    await expect(page.getByText(/délai de validation expiré|validation deadline expired/i)).toBeVisible();

    // Should show auto-release message
    await expect(page.getByText(/fonds seront libérés automatiquement|funds will be released automatically/i)).toBeVisible();
  });
});

test.describe('Validation Flow - Edge Cases', () => {
  let seller: any;
  let buyer: any;
  const testUserIds: string[] = [];

  test.beforeAll(async () => {
    seller = await createTestUser('seller', 'edge-seller');
    buyer = await createTestUser('buyer', 'edge-buyer');
    testUserIds.push(seller.id, buyer.id);
  });

  test.afterAll(async () => {
    await cleanupTestData(testUserIds);
  });

  test('cannot mark unpaid transaction as completed', async ({ page }) => {
    const { createTestTransaction } = await import('./helpers/test-fixtures');
    const pendingTransaction = await createTestTransaction(seller.id, buyer.id, {
      amount: 800,
      status: 'pending',
    });

    await loginUser(page, seller);
    await page.getByRole('link', { name: /transactions/i }).click();
    await page.getByText(pendingTransaction.id.substring(0, 8)).click();

    // Complete button should not be visible
    const completeButton = page.getByRole('button', { name: /marquer comme terminé|mark as completed/i });
    await expect(completeButton).not.toBeVisible();

    // Should see payment pending message
    await expect(page.getByText(/paiement en attente|payment pending/i)).toBeVisible();
  });

  test('seller cannot validate their own transaction', async ({ page }) => {
    const transaction = await createPaidTransaction(seller.id, buyer.id, 600);
    await markTransactionCompleted(transaction.id);

    // Login as seller
    await loginUser(page, seller);
    await page.getByRole('link', { name: /transactions/i }).click();
    await page.getByText(transaction.id.substring(0, 8)).click();

    // Validate button should not be visible
    const validateButton = page.getByRole('button', { name: /valider et libérer|validate and release/i });
    await expect(validateButton).not.toBeVisible();

    // Should see waiting for buyer message
    await expect(page.getByText(/en attente de validation de l'acheteur/i)).toBeVisible();
  });

  test('transaction timeline shows all status changes', async ({ page }) => {
    const transaction = await createPaidTransaction(seller.id, buyer.id, 400);
    await markTransactionCompleted(transaction.id);

    await loginUser(page, buyer);
    await page.getByRole('link', { name: /transactions/i }).click();
    await page.getByText(transaction.id.substring(0, 8)).click();

    // Should see transaction timeline
    await expect(page.locator('[data-testid="transaction-timeline"]')).toBeVisible();

    // Should show creation, payment, and completion events
    await expect(page.getByText(/transaction créée|created/i)).toBeVisible();
    await expect(page.getByText(/paiement reçu|payment received/i)).toBeVisible();
    await expect(page.getByText(/marqué comme terminé|marked as completed/i)).toBeVisible();
  });
});
