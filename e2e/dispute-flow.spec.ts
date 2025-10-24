import { test, expect } from '@playwright/test';
import { createTestUser, loginAdmin, loginUser, createPaidTransaction, createTestDispute, type TestUser } from './helpers/test-fixtures';
import { supabase } from '../src/integrations/supabase/client';

/**
 * E2E tests for dispute escalation flow
 * 
 * Critical user journey:
 * 1. Buyer creates dispute on paid transaction
 * 2. Seller responds to dispute
 * 3. Negotiation or escalation to admin
 * 4. Admin resolves dispute
 */

// Dynamic users created for tests
let BUYER: TestUser;
let SELLER: TestUser;

// Create users once for all tests
test.beforeAll(async () => {
  SELLER = await createTestUser('seller', 'e2e-seller-dispute');
  BUYER = await createTestUser('buyer', 'e2e-buyer-dispute');
  // Ensure at least one paid transaction exists
  await createPaidTransaction(SELLER.id, BUYER.id, 100);
});

test.describe('Dispute Flow - Complete Journey', () => {
  test('buyer can create dispute on paid transaction', async ({ page }) => {
    // Login as buyer
    await loginUser(page, BUYER);
    
    // Navigate to transactions
    await page.getByRole('link', { name: /transactions/i }).click();
    
    // Find a paid transaction
    await page.getByText(/payé/i).first().click();
    
    // Open dispute dialog
    await page.getByRole('button', { name: /ouvrir un litige/i }).click();
    
    // Fill dispute form
    await page.getByLabel(/motif/i).selectOption('quality_issue');
    await page.getByLabel(/description/i).fill('Produit non conforme à la description');
    
    // Submit dispute
    await page.getByRole('button', { name: /soumettre/i }).click();
    
    // Should see success message
    await expect(page.getByText(/litige créé/i)).toBeVisible();
    
    // Should redirect to dispute view
    await expect(page.getByText(/statut.*ouvert/i)).toBeVisible();
  });

  test('seller can respond to dispute', async ({ page, context }) => {
    // Login as seller
    await loginUser(page, SELLER);
    
    // Navigate to disputes
    await page.getByRole('link', { name: /litiges/i }).click();
    
    // Should see dispute notification
    await expect(page.getByText(/nouveau litige/i)).toBeVisible();
    
    // Click on dispute
    await page.locator('[data-testid="dispute-card"]').first().click();
    
    // Send response message
    await page.getByPlaceholder(/votre message/i).fill('Je comprends votre insatisfaction. Voici ma proposition...');
    await page.getByRole('button', { name: /envoyer/i }).click();
    
    // Create counter-proposal
    await page.getByRole('button', { name: /proposer une solution/i }).click();
    await page.getByLabel(/type de proposition/i).selectOption('partial_refund');
    await page.getByLabel(/pourcentage/i).fill('50');
    await page.getByLabel(/message/i).fill('Je propose un remboursement de 50%');
    await page.getByRole('button', { name: /soumettre la proposition/i }).click();
    
    // Should see proposal in conversation
    await expect(page.getByText(/proposition.*50%/i)).toBeVisible();
  });

  test('dispute escalates to admin after deadline', async ({ page }) => {
    // Login as buyer
    await loginUser(page, BUYER);
    
    // Navigate to disputes
    await page.getByRole('link', { name: /litiges/i }).click();
    
    // Find escalated dispute (status = escalated)
    await page.getByText(/escaladé/i).first().click();
    
    // Should see admin notification
    await expect(page.getByText(/litige escaladé.*administrateur/i)).toBeVisible();
    
    // Should NOT be able to send messages to other party
    await expect(page.getByPlaceholder(/envoyer un message/i)).toBeDisabled();
    
    // Should have separate admin conversation
    await expect(page.getByText(/conversation avec l'administrateur/i)).toBeVisible();
  });

  test('admin can view and resolve escalated dispute', async ({ page }) => {
    // Create a paid transaction and open a dispute
    const tx = await createPaidTransaction(SELLER.id, BUYER.id, 150);
    const dispute = await createTestDispute(tx.id, BUYER.id, 'Produit non conforme');
    
    // Create admin user and force escalate via edge function (auth required)
    const adminUser = await createTestUser('admin', 'admin-e2e-dispute-resolve');
    
    // Programmatic escalation using admin credentials
    await supabase.auth.signOut();
    // sign in as admin in Node client (uses stored creds via createTestUser)
    // The test-fixtures has userCredentials map; reusing signInAs is simpler
    // But we don't import it here; perform direct sign-in
    await supabase.auth.signInWithPassword({ email: adminUser.email, password: adminUser.password });
    await supabase.functions.invoke('force-escalate-dispute', { body: { disputeId: dispute.id } });
    
    // UI login as admin
    await loginAdmin(page, adminUser);
    
    // Navigate to admin disputes
    await page.locator('a[href="/dashboard/admin/disputes"]').first().click();
    await page.waitForTimeout(1200);
    
    // Should see escalated disputes section or card
    const hasEscalatedText = await page.getByText(/litiges escaladés/i).isVisible().catch(() => false);
    const hasDisputeCard = await page.locator('[data-testid="admin-dispute-card"]').first().isVisible().catch(() => false);
    
    if (!hasEscalatedText && !hasDisputeCard) {
      throw new Error('No escalated disputes visible on admin page');
    }
    
    // Click on first escalated dispute
    await page.locator('[data-testid="admin-dispute-card"]').first().click();
    
    // Should see both conversations (admin-seller + admin-buyer)
    await expect(page.getByText(/conversation avec le vendeur/i)).toBeVisible();
    await expect(page.getByText(/conversation avec l'acheteur/i)).toBeVisible();
    
    // Create admin proposal
    await page.getByRole('button', { name: /proposer une résolution/i }).click();
    await page.getByLabel(/type de résolution/i).selectOption('partial_refund');
    await page.getByLabel(/pourcentage/i).fill('70');
    await page.getByLabel(/justification/i).fill('Après analyse, remboursement de 70% justifié');
    await page.getByRole('button', { name: /soumettre la proposition/i }).click();
    
    // Should see proposal sent to both parties
    await expect(page.getByText(/proposition envoyée/i)).toBeVisible();
  });

  test('buyer accepts admin proposal and dispute is resolved', async ({ page }) => {
    // Login as buyer
    await loginUser(page, BUYER);
    
    // Navigate to disputes
    await page.getByRole('link', { name: /litiges/i }).click();
    
    // Find dispute with admin proposal
    await page.getByText(/proposition de l'administrateur/i).first().click();
    
    // Should see admin proposal
    await expect(page.getByText(/proposition.*70%/i)).toBeVisible();
    
    // Accept proposal
    await page.getByRole('button', { name: /accepter/i }).click();
    
    // Confirm in dialog
    await page.getByRole('button', { name: /confirmer/i }).click();
    
    // Should see success message
    await expect(page.getByText(/proposition acceptée/i)).toBeVisible();
    
    // Dispute status should be resolved
    await expect(page.getByText(/résolu/i)).toBeVisible();
  });
});

test.describe('Dispute Flow - Edge Cases', () => {
  test('cannot create dispute on unpaid transaction', async ({ page }) => {
    await loginUser(page, BUYER);
    await page.getByRole('link', { name: /transactions/i }).click();
    
    // Find pending transaction
    await page.getByText(/en attente/i).first().click();
    
    // Dispute button should be disabled or not visible
    const disputeButton = page.getByRole('button', { name: /ouvrir un litige/i });
    await expect(disputeButton).not.toBeVisible();
  });

  test('dispute deadline countdown is displayed', async ({ page }) => {
    await loginUser(page, BUYER);
    await page.getByRole('link', { name: /litiges/i }).click();
    
    // Click on active dispute
    await page.locator('[data-testid="dispute-card"]').first().click();
    
    // Should see countdown
    await expect(page.getByText(/temps restant/i)).toBeVisible();
    await expect(page.locator('[data-testid="dispute-countdown"]')).toBeVisible();
  });

  test('archived disputes do not appear in active list', async ({ page }) => {
    await loginUser(page, BUYER);
    await page.getByRole('link', { name: /litiges/i }).click();
    
    // Find resolved dispute
    await page.getByText(/résolu/i).first().click();
    
    // Archive dispute
    await page.getByRole('button', { name: /archiver/i }).click();
    await page.getByRole('button', { name: /confirmer/i }).click();
    
    // Should redirect back to list
    await page.waitForURL(/disputes$/);
    
    // Archived dispute should not be visible
    await expect(page.getByText(/aucun litige actif/i)).toBeVisible();
  });
});
