import { test, expect } from '@playwright/test';
import { createTestUser, loginAdmin, type TestUser } from './helpers/test-fixtures';

/**
 * E2E tests for dispute escalation flow
 * 
 * Critical user journey:
 * 1. Buyer creates dispute on paid transaction
 * 2. Seller responds to dispute
 * 3. Negotiation or escalation to admin
 * 4. Admin resolves dispute
 */

// Test credentials (to be replaced with actual test users)
const TEST_SELLER = {
  email: 'seller-test@rivvlock.com',
  password: 'Test123!@#',
};

const TEST_BUYER = {
  email: 'buyer-test@rivvlock.com',
  password: 'Test123!@#',
};

test.describe('Dispute Flow - Complete Journey', () => {
  test('buyer can create dispute on paid transaction', async ({ page }) => {
    // Login as buyer
    await page.goto('/auth');
    await page.getByLabel(/email/i).fill(TEST_BUYER.email);
    await page.getByLabel(/mot de passe/i).fill(TEST_BUYER.password);
    await page.getByRole('button', { name: /connexion/i }).click();
    
    // Wait for dashboard
    await page.waitForURL('/dashboard');
    
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
    await page.goto('/auth');
    await page.getByLabel(/email/i).fill(TEST_SELLER.email);
    await page.getByLabel(/mot de passe/i).fill(TEST_SELLER.password);
    await page.getByRole('button', { name: /connexion/i }).click();
    
    await page.waitForURL('/dashboard');
    
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
    await page.goto('/auth');
    await page.getByLabel(/email/i).fill(TEST_BUYER.email);
    await page.getByLabel(/mot de passe/i).fill(TEST_BUYER.password);
    await page.getByRole('button', { name: /connexion/i }).click();
    
    await page.waitForURL('/dashboard');
    
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
    // Create admin user
    const adminUser = await createTestUser('admin', 'admin-e2e-dispute-resolve');
    
    // Login as admin
    await loginAdmin(page, adminUser);
    
    // Navigate to disputes (use precise href selector)
    await page.locator('a[href="/dashboard/admin/disputes"]').first().click();
    
    // Should see escalated disputes
    await expect(page.getByText(/litiges escaladés/i)).toBeVisible();
    
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
    await page.goto('/auth');
    await page.getByLabel(/email/i).fill(TEST_BUYER.email);
    await page.getByLabel(/mot de passe/i).fill(TEST_BUYER.password);
    await page.getByRole('button', { name: /connexion/i }).click();
    
    await page.waitForURL('/dashboard');
    
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
    await page.goto('/auth');
    await page.getByLabel(/email/i).fill(TEST_BUYER.email);
    await page.getByLabel(/mot de passe/i).fill(TEST_BUYER.password);
    await page.getByRole('button', { name: /connexion/i }).click();
    
    await page.waitForURL('/dashboard');
    await page.getByRole('link', { name: /transactions/i }).click();
    
    // Find pending transaction
    await page.getByText(/en attente/i).first().click();
    
    // Dispute button should be disabled or not visible
    const disputeButton = page.getByRole('button', { name: /ouvrir un litige/i });
    await expect(disputeButton).not.toBeVisible();
  });

  test('dispute deadline countdown is displayed', async ({ page }) => {
    await page.goto('/auth');
    await page.getByLabel(/email/i).fill(TEST_BUYER.email);
    await page.getByLabel(/mot de passe/i).fill(TEST_BUYER.password);
    await page.getByRole('button', { name: /connexion/i }).click();
    
    await page.waitForURL('/dashboard');
    await page.getByRole('link', { name: /litiges/i }).click();
    
    // Click on active dispute
    await page.locator('[data-testid="dispute-card"]').first().click();
    
    // Should see countdown
    await expect(page.getByText(/temps restant/i)).toBeVisible();
    await expect(page.locator('[data-testid="dispute-countdown"]')).toBeVisible();
  });

  test('archived disputes do not appear in active list', async ({ page }) => {
    await page.goto('/auth');
    await page.getByLabel(/email/i).fill(TEST_BUYER.email);
    await page.getByLabel(/mot de passe/i).fill(TEST_BUYER.password);
    await page.getByRole('button', { name: /connexion/i }).click();
    
    await page.waitForURL('/dashboard');
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
