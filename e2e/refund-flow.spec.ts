import { test, expect } from '@playwright/test';
import {
  createPaidTransaction,
  createTestDispute,
  loginUser,
  cleanupTestData,
} from './helpers/test-fixtures';
import { getTestUser, releaseTestUser } from './helpers/user-pool';

/**
 * E2E tests for refund flow
 * 
 * Critical scenarios:
 * 1. Full refund via dispute resolution
 * 2. Partial refund via admin proposal
 * 3. Automatic refund on payment cancellation
 * 4. Refund status tracking
 */

test.describe('Refund Flow - Dispute Resolution', () => {
  let seller: any;
  let buyer: any;
  let admin: any;
  const testUserIds: string[] = [];

  test.beforeAll(async () => {
    seller = await getTestUser('seller');
    buyer = await getTestUser('buyer');
    admin = await getTestUser('seller'); // Use seller as admin
    testUserIds.push(seller.id, buyer.id, admin.id);
  });

  test.afterAll(async () => {
    releaseTestUser(seller.id);
    releaseTestUser(buyer.id);
    releaseTestUser(admin.id);
    await cleanupTestData(testUserIds);
  });

  test('full refund proposal can be created and accepted', async ({ page }) => {
    // Create paid transaction
    const transaction = await createPaidTransaction(seller.id, buyer.id, 1000);

    // Create dispute
    const dispute = await createTestDispute(transaction.id, buyer.id, 'not_as_described');

    // Login as seller
    await loginUser(page, seller);

    // Navigate to disputes
    await page.getByRole('link', { name: /litiges|disputes/i }).click();

    // Find the dispute
    await page.getByText(dispute.id.substring(0, 8)).click();

    // Create full refund proposal
    await page.getByRole('button', { name: /proposer une solution|propose solution/i }).click();
    await page.getByLabel(/type/i).selectOption('full_refund');
    await page.getByLabel(/message/i).fill('Je propose un remboursement complet');
    await page.getByRole('button', { name: /soumettre|submit/i }).click();

    // Should see proposal sent
    await expect(page.getByText(/proposition envoyée|proposal sent/i)).toBeVisible();

    // Logout and login as buyer
    await page.getByRole('button', { name: /menu/i }).click();
    await page.getByRole('button', { name: /déconnexion|logout/i }).click();

    await loginUser(page, buyer);

    // Navigate to disputes
    await page.getByRole('link', { name: /litiges|disputes/i }).click();
    await page.getByText(dispute.id.substring(0, 8)).click();

    // Should see full refund proposal
    await expect(page.getByText(/remboursement complet|full refund/i)).toBeVisible();

    // Accept proposal
    await page.getByRole('button', { name: /accepter|accept/i }).click();
    await page.getByRole('button', { name: /confirmer|confirm/i }).click();

    // Should see success message
    await expect(page.getByText(/proposition acceptée|proposal accepted/i)).toBeVisible();

    // Dispute should be resolved
    await expect(page.getByText(/résolu|resolved/i)).toBeVisible();

    // Check transaction status
    await page.getByRole('link', { name: /transactions/i }).click();
    await page.getByText(transaction.id.substring(0, 8)).click();

    // Should show refund in progress
    await expect(page.getByText(/remboursement en cours|refund in progress/i)).toBeVisible();
  });

  test('partial refund with percentage calculation', async ({ page }) => {
    const transaction = await createPaidTransaction(seller.id, buyer.id, 2000);
    const dispute = await createTestDispute(transaction.id, buyer.id, 'quality_issue');

    await loginUser(page, seller);
    await page.getByRole('link', { name: /litiges|disputes/i }).click();
    await page.getByText(dispute.id.substring(0, 8)).click();

    // Create 50% refund proposal
    await page.getByRole('button', { name: /proposer une solution|propose solution/i }).click();
    await page.getByLabel(/type/i).selectOption('partial_refund');
    await page.getByLabel(/pourcentage|percentage/i).fill('50');

    // Should auto-calculate refund amount
    await expect(page.getByText(/1000.*CHF/i)).toBeVisible(); // 50% of 2000

    await page.getByLabel(/message/i).fill('Remboursement partiel de 50%');
    await page.getByRole('button', { name: /soumettre|submit/i }).click();

    await expect(page.getByText(/proposition envoyée/i)).toBeVisible();
  });

  test('admin can propose custom refund percentage', async ({ page }) => {
    const transaction = await createPaidTransaction(seller.id, buyer.id, 1500);
    const dispute = await createTestDispute(transaction.id, buyer.id, 'defective_product');

    // Escalate dispute (simulate deadline expiry)
    const { supabase } = await import('../src/integrations/supabase/client');
    await supabase
      .from('disputes')
      .update({
        status: 'escalated',
        escalated_at: new Date().toISOString(),
      })
      .eq('id', dispute.id);

    // Login as admin
    await loginUser(page, admin);

    // Navigate to admin disputes
    await page.goto('/dashboard/admin/disputes');

    // Find escalated dispute
    await page.getByRole('tab', { name: /escaladés|escalated/i }).click();
    await page.getByText(dispute.id.substring(0, 8)).click();

    // Create admin proposal with custom percentage
    await page.getByRole('button', { name: /proposer une résolution|propose resolution/i }).click();
    await page.getByLabel(/type/i).selectOption('partial_refund');
    await page.getByLabel(/pourcentage/i).fill('65');

    // Should show calculated amount
    await expect(page.getByText(/975.*CHF/i)).toBeVisible(); // 65% of 1500

    await page.getByLabel(/justification vendeur|seller justification/i).fill('Défaut partiel constaté');
    await page.getByLabel(/justification acheteur|buyer justification/i).fill('Remboursement partiel justifié');
    await page.getByRole('button', { name: /envoyer|send/i }).click();

    // Should see proposal sent to both parties
    await expect(page.getByText(/proposition envoyée aux deux parties/i)).toBeVisible();
  });
});

test.describe('Refund Flow - Stripe Integration', () => {
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

  test('refund status is tracked in transaction', async ({ page }) => {
    const transaction = await createPaidTransaction(seller.id, buyer.id, 800);
    const dispute = await createTestDispute(transaction.id, buyer.id, 'unauthorized');

    // Simulate accepted full refund proposal
    const { supabase } = await import('../src/integrations/supabase/client');
    await supabase.from('disputes').update({ status: 'resolved' }).eq('id', dispute.id);
    await supabase
      .from('transactions')
      .update({
        refund_status: 'pending',
        refund_amount: 800,
      })
      .eq('id', transaction.id);

    await loginUser(page, buyer);
    await page.getByRole('link', { name: /transactions/i }).click();
    await page.getByText(transaction.id.substring(0, 8)).click();

    // Should display refund status
    await expect(page.getByText(/remboursement en cours|refund pending/i)).toBeVisible();
    await expect(page.getByText(/800.*CHF/i)).toBeVisible();

    // Should show refund timeline
    await expect(page.locator('[data-testid="refund-status"]')).toBeVisible();
  });

  test('partial refund shows correct amounts in transaction', async ({ page }) => {
    const transaction = await createPaidTransaction(seller.id, buyer.id, 1200);

    // Simulate partial refund
    const { supabase } = await import('../src/integrations/supabase/client');
    await supabase
      .from('transactions')
      .update({
        refund_status: 'completed',
        refund_amount: 600, // 50% refund
      })
      .eq('id', transaction.id);

    await loginUser(page, buyer);
    await page.getByRole('link', { name: /transactions/i }).click();
    await page.getByText(transaction.id.substring(0, 8)).click();

    // Should show original and refunded amounts
    await expect(page.getByText(/montant original.*1200.*CHF/i)).toBeVisible();
    await expect(page.getByText(/remboursé.*600.*CHF/i)).toBeVisible();
    await expect(page.getByText(/montant net.*600.*CHF/i)).toBeVisible();
  });

  test('completed refund shows in transaction history', async ({ page }) => {
    const transaction = await createPaidTransaction(seller.id, buyer.id, 500);

    const { supabase } = await import('../src/integrations/supabase/client');
    await supabase
      .from('transactions')
      .update({
        refund_status: 'completed',
        refund_amount: 500,
      })
      .eq('id', transaction.id);

    await loginUser(page, buyer);
    await page.getByRole('link', { name: /transactions/i }).click();
    await page.getByText(transaction.id.substring(0, 8)).click();

    // Should show refund completed badge
    await expect(page.getByText(/remboursement effectué|refund completed/i)).toBeVisible();

    // Timeline should show refund event
    await expect(page.locator('[data-testid="transaction-timeline"]')).toContainText(/remboursement|refund/i);
  });
});

test.describe('Refund Flow - Error Handling', () => {
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

  test('handles refund failures gracefully', async ({ page }) => {
    const transaction = await createPaidTransaction(seller.id, buyer.id, 1000);

    // Simulate failed refund
    const { supabase } = await import('../src/integrations/supabase/client');
    await supabase
      .from('transactions')
      .update({
        refund_status: 'failed',
        refund_amount: 1000,
      })
      .eq('id', transaction.id);

    await loginUser(page, buyer);
    await page.getByRole('link', { name: /transactions/i }).click();
    await page.getByText(transaction.id.substring(0, 8)).click();

    // Should show error state
    await expect(page.getByText(/échec du remboursement|refund failed/i)).toBeVisible();

    // Should show retry option
    await expect(page.getByRole('button', { name: /contacter le support|contact support/i })).toBeVisible();
  });

  test('cannot refund already completed transaction', async ({ page }) => {
    const transaction = await createPaidTransaction(seller.id, buyer.id, 700);

    // Mark as completed
    const { supabase } = await import('../src/integrations/supabase/client');
    await supabase
      .from('transactions')
      .update({
        status: 'completed',
        funds_released: true,
      })
      .eq('id', transaction.id);

    await loginUser(page, buyer);
    await page.getByRole('link', { name: /transactions/i }).click();
    await page.getByText(transaction.id.substring(0, 8)).click();

    // Create dispute button should show warning
    await page.getByRole('button', { name: /ouvrir un litige|open dispute/i }).click();

    // Should show warning about completed transaction
    await expect(page.getByText(/fonds déjà libérés|funds already released/i)).toBeVisible();
  });
});
