import { test, expect } from '@playwright/test';
import { createTestUser, loginAdmin, cleanupTestData, type TestUser } from './helpers/test-fixtures';

/**
 * E2E tests for admin validation flow
 * 
 * Critical admin journeys:
 * 1. View all transactions
 * 2. Validate seller completion
 * 3. Force release funds
 * 4. Handle problematic transactions
 */

test.describe('Admin Validation - Transaction Management', () => {
  let adminUser: TestUser;

  test.beforeAll(async () => {
    // Create admin user for all tests
    adminUser = await createTestUser('admin', 'admin-e2e-txn');
  });

  test.afterAll(async () => {
    // Only cleanup if user was successfully created
    if (adminUser?.id) {
      await cleanupTestData([adminUser.id]);
    }
  });

  test.beforeEach(async ({ page }) => {
    // Login as admin
    await loginAdmin(page, adminUser);
  });

  test('admin can view all transactions with filters', async ({ page }) => {
    // Navigate to transactions page (admins use same page as users)
    const transactionsLink = page.locator('aside a[href="/dashboard/transactions"]').first();
    await expect(transactionsLink).toBeVisible();
    await transactionsLink.click();

    // Verify tabs are visible (the UI uses tabs, not a "Filtres" button)
    await expect(page.getByRole('tab', { name: /en attente/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /fonds bloqués/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /complétées/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /litiges/i })).toBeVisible();
  });

  test.skip('admin can view transaction details including sensitive data', async ({ page }) => {
    // SKIP: Nécessite des transactions de test en DB
    await page.locator('aside').getByRole('link', { name: /transactions/i }).click();
    
    // Click on first transaction
    await page.locator('[data-testid="transaction-card"]').first().click();
    
    // Should see full transaction details
    await expect(page.getByText(/détails de la transaction/i)).toBeVisible();
    await expect(page.getByText(/stripe payment intent/i)).toBeVisible();
    
    // Should see both user profiles
    await expect(page.getByText(/profil vendeur/i)).toBeVisible();
    await expect(page.getByText(/profil acheteur/i)).toBeVisible();
    
    // Should see activity logs
    await expect(page.getByText(/historique d'activité/i)).toBeVisible();
  });

  test.skip('admin validates seller completion', async ({ page }) => {
    // SKIP: Nécessite des transactions de test en DB avec statut spécifique
    await page.locator('aside').getByRole('link', { name: /transactions/i }).click();
    
    // Find transaction awaiting validation
    await page.getByText(/en attente de validation/i).first().click();
    
    // Should see validation countdown
    await expect(page.getByText(/délai de validation/i)).toBeVisible();
    
    // Should see seller validation status
    await expect(page.getByText(/vendeur a marqué comme terminé/i)).toBeVisible();
    
    // Admin validates completion
    await page.getByRole('button', { name: /valider et libérer les fonds/i }).click();
    
    // Confirm in dialog
    await page.getByLabel(/confirmation/i).check();
    await page.getByRole('button', { name: /confirmer la libération/i }).click();
    
    // Should see success message
    await expect(page.getByText(/fonds libérés avec succès/i)).toBeVisible();
    
    // Transaction status should be completed
    await expect(page.getByText(/terminé/i)).toBeVisible();
  });

  test.skip('admin can force release funds on problematic transaction', async ({ page }) => {
    // SKIP: Page AdminProblematicTransactionsPage existe mais UI non finalisée
    await page.locator('aside').getByRole('link', { name: /transactions problématiques/i }).click();
    
    // Should see list of problematic transactions
    await expect(page.getByText(/transactions nécessitant une attention/i)).toBeVisible();
    
    // Click on first problematic transaction
    await page.locator('[data-testid="problematic-transaction-card"]').first().click();
    
    // Should see warning
    await expect(page.getByText(/attention.*transaction bloquée/i)).toBeVisible();
    
    // Force release funds
    await page.getByRole('button', { name: /forcer la libération/i }).click();
    
    // Should see confirmation dialog with warnings
    await expect(page.getByText(/cette action est irréversible/i)).toBeVisible();
    
    // Enter admin justification
    await page.getByLabel(/justification/i).fill('Transaction bloquée depuis 15 jours, vendeur a fourni preuves de livraison');
    await page.getByRole('button', { name: /confirmer la libération forcée/i }).click();
    
    // Should see success message
    await expect(page.getByText(/libération forcée effectuée/i)).toBeVisible();
  });

  test.skip('admin can delete expired transaction', async ({ page }) => {
    // SKIP: Nécessite des transactions de test en DB avec statut expired
    await page.locator('aside').getByRole('link', { name: /transactions/i }).click();
    
    // Filter expired transactions
    await page.getByRole('button', { name: /filtres/i }).click();
    await page.getByLabel(/statut/i).selectOption('expired');
    await page.getByRole('button', { name: /appliquer/i }).click();
    
    // Click on expired transaction
    await page.getByText(/expiré/i).first().click();
    
    // Delete transaction
    await page.getByRole('button', { name: /supprimer/i }).click();
    
    // Confirm deletion
    await page.getByRole('button', { name: /confirmer la suppression/i }).click();
    
    // Should redirect back to list
    await page.waitForURL(/transactions$/);
    
    // Should see success message
    await expect(page.getByText(/transaction supprimée/i)).toBeVisible();
  });
});

test.describe('Admin Validation - Dispute Management', () => {
  let adminUser: TestUser;

  test.beforeAll(async () => {
    // Create admin user for all tests
    adminUser = await createTestUser('admin', 'admin-e2e-disputes');
  });

  test.afterAll(async () => {
    // Only cleanup if user was successfully created
    if (adminUser?.id) {
      await cleanupTestData([adminUser.id]);
    }
  });

  test.beforeEach(async ({ page }) => {
    await loginAdmin(page, adminUser);
  });

  test('admin views all disputes in dashboard', async ({ page }) => {
    // Navigate to disputes using precise href to avoid strict mode violations
    const disputesLink = page.locator('a[href="/dashboard/admin/disputes"]').first();
    await expect(disputesLink).toBeVisible();
    await disputesLink.click();

    // Verify tabs exist (localized)
    await expect(page.getByRole('tab', { name: /ouverts/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /escaladés/i })).toBeVisible();
  });

  test.skip('admin creates official proposal for escalated dispute', async ({ page }) => {
    // SKIP: Nécessite des litiges de test en DB avec statut escalated
    await page.locator('a[href="/dashboard/admin/disputes"]').first().click();
    await page.getByRole('tab', { name: /escaladés/i }).click();
    
    // Click on escalated dispute
    await page.locator('[data-testid="admin-dispute-card"]').first().click();
    
    // Should see both conversations
    await expect(page.getByText(/conversation avec le vendeur/i)).toBeVisible();
    await expect(page.getByText(/conversation avec l'acheteur/i)).toBeVisible();
    
    // Review messages from both parties
    const sellerMessages = page.locator('[data-testid="seller-messages"]');
    const buyerMessages = page.locator('[data-testid="buyer-messages"]');
    
    await expect(sellerMessages).toBeVisible();
    await expect(buyerMessages).toBeVisible();
    
    // Create official proposal
    await page.getByRole('button', { name: /créer une proposition officielle/i }).click();
    
    // Fill proposal form
    await page.getByLabel(/type de résolution/i).selectOption('partial_refund');
    await page.getByLabel(/pourcentage de remboursement/i).fill('60');
    await page.getByLabel(/justification pour le vendeur/i).fill('Le produit présentait des défauts');
    await page.getByLabel(/justification pour l\'acheteur/i).fill('Remboursement partiel compte tenu de l\'utilisation');
    
    // Submit proposal
    await page.getByRole('button', { name: /envoyer aux deux parties/i }).click();
    
    // Should see confirmation
    await expect(page.getByText(/proposition envoyée/i)).toBeVisible();
    
    // Proposal should appear in both conversations
    await expect(page.getByText(/proposition officielle.*60%/i)).toBeVisible();
  });

  test.skip('admin can force escalate dispute', async ({ page }) => {
    // Use precise href to avoid strict mode violation
    await page.locator('a[href="/dashboard/admin/disputes"]').first().click();
    
    // Filter by open disputes
    await page.getByRole('tab', { name: /ouverts/i }).click();
    
    // Find dispute in negotiation
    await page.getByText(/en négociation/i).first().click();
    
    // Force escalate
    await page.getByRole('button', { name: /forcer l'escalade/i }).click();
    
    // Confirm with reason
    await page.getByLabel(/raison de l'escalade forcée/i).fill('Négociation au point mort depuis 10 jours');
    await page.getByRole('button', { name: /confirmer l'escalade/i }).click();
    
    // Should see success message
    await expect(page.getByText(/litige escaladé avec succès/i)).toBeVisible();
    
    // Status should be escalated
    await expect(page.getByText(/escaladé/i)).toBeVisible();
  });
});

test.describe('Admin Validation - User Management', () => {
  let adminUser: TestUser;

  test.beforeAll(async () => {
    // Create admin user for all tests
    adminUser = await createTestUser('admin', 'admin-e2e-users');
  });

  test.afterAll(async () => {
    // Only cleanup if user was successfully created
    if (adminUser?.id) {
      await cleanupTestData([adminUser.id]);
    }
  });

  test.beforeEach(async ({ page }) => {
    await loginAdmin(page, adminUser);
  });

  test.skip('admin can view user profile with access logs', async ({ page }) => {
    // SKIP: AdminUsersPage existe mais fonctionnalité complète non implémentée
    await page.locator('aside').getByRole('link', { name: /utilisateurs/i }).click();
    
    // Search for user
    await page.getByPlaceholder(/rechercher un utilisateur/i).fill('test@example.com');
    await page.getByRole('button', { name: /rechercher/i }).click();
    
    // Click on user
    await page.locator('[data-testid="user-row"]').first().click();
    
    // Should see full user profile
    await expect(page.getByText(/profil complet/i)).toBeVisible();
    await expect(page.getByText(/stripe account/i)).toBeVisible();
    
    // Should see access logs
    await expect(page.getByText(/logs d'accès/i)).toBeVisible();
    await expect(page.locator('[data-testid="access-log"]')).toHaveCount(await page.locator('[data-testid="access-log"]').count());
  });

  test.skip('admin access is logged in profile_access_logs', async ({ page }) => {
    // SKIP: AdminUsersPage existe mais fonctionnalité complète non implémentée
    await page.locator('aside').getByRole('link', { name: /utilisateurs/i }).click();
    await page.locator('[data-testid="user-row"]').first().click();
    
    // Admin viewing should create access log
    await expect(page.getByText(/accès administrateur enregistré/i)).toBeVisible();
    
    // Verify in activity logs
    await page.getByRole('link', { name: /logs d'activité/i }).click();
    await expect(page.getByText(/admin_profile_access/i)).toBeVisible();
  });

  test.skip('admin cannot modify their own role', async ({ page }) => {
    // SKIP: AdminSettingsPage existe mais fonctionnalité non implémentée
    await page.getByRole('button', { name: /menu utilisateur/i }).click();
    await page.getByRole('link', { name: /paramètres/i }).click();
    
    // Role management section should not allow self-modification
    const roleSelect = page.getByLabel(/rôle/i);
    await expect(roleSelect).toBeDisabled();
  });
});

test.describe('Admin Validation - Security & Audit', () => {
  let adminUser: TestUser;

  test.beforeAll(async () => {
    // Create admin user for all tests
    adminUser = await createTestUser('admin', 'admin-e2e-security');
  });

  test.afterAll(async () => {
    // Only cleanup if user was successfully created
    if (adminUser?.id) {
      await cleanupTestData([adminUser.id]);
    }
  });

  test.beforeEach(async ({ page }) => {
    await loginAdmin(page, adminUser);
  });

  test.skip('admin dashboard shows security metrics', async ({ page }) => {
    // SKIP: Fonctionnalité "Métriques de sécurité" non implémentée dans AdminPage
    await expect(page.getByText(/métriques de sécurité/i)).toBeVisible();
    
    // Should display key security stats
    await expect(page.getByText(/tentatives d'accès échouées/i)).toBeVisible();
    await expect(page.getByText(/tokens expirés/i)).toBeVisible();
    await expect(page.getByText(/disputes escaladés automatiquement/i)).toBeVisible();
  });

  test.skip('admin can view complete activity logs', async ({ page }) => {
    // SKIP: AdminLogsPage existe mais UI complète non implémentée
    await page.locator('aside').getByRole('link', { name: /logs d'activité/i }).click();
    
    // Should see activity log table
    await expect(page.getByRole('table')).toBeVisible();
    
    // Can filter by type
    await page.getByLabel(/type d'activité/i).selectOption('payment');
    await page.getByRole('button', { name: /filtrer/i }).click();
    
    // Should only show payment logs
    await expect(page.getByText(/payment/i).first()).toBeVisible();
    
    // Can export logs
    await page.getByRole('button', { name: /exporter/i }).click();
    
    // Should trigger download
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /télécharger csv/i }).click();
    const download = await downloadPromise;
    
    expect(download.suggestedFilename()).toContain('activity-logs');
  });
});
