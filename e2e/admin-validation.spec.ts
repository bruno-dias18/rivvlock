import { test, expect } from '@playwright/test';

/**
 * E2E tests for admin validation flow
 * 
 * Critical admin journeys:
 * 1. View all transactions
 * 2. Validate seller completion
 * 3. Force release funds
 * 4. Handle problematic transactions
 */

const TEST_ADMIN = {
  email: 'admin-test@rivvlock.com',
  password: 'Admin123!@#',
};

test.describe('Admin Validation - Transaction Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/auth');
    await page.getByLabel(/email/i).fill(TEST_ADMIN.email);
    await page.getByLabel(/mot de passe/i).fill(TEST_ADMIN.password);
    await page.getByRole('button', { name: /connexion/i }).click();
    
    // Should redirect to admin dashboard
    await page.waitForURL('/dashboard/admin');
  });

  test('admin can view all transactions with filters', async ({ page }) => {
    // Should see admin dashboard
    await expect(page.getByRole('heading', { name: /administration/i })).toBeVisible();
    
    // Should see transaction stats
    await expect(page.getByText(/transactions actives/i)).toBeVisible();
    await expect(page.getByText(/en attente de validation/i)).toBeVisible();
    
    // Navigate to transactions
    await page.getByRole('link', { name: /transactions/i }).click();
    
    // Should see all transactions (not just own)
    const transactionCards = page.locator('[data-testid="transaction-card"]');
    await expect(transactionCards).toHaveCount(await transactionCards.count());
    
    // Test filters
    await page.getByRole('button', { name: /filtres/i }).click();
    await page.getByLabel(/statut/i).selectOption('paid');
    await page.getByRole('button', { name: /appliquer/i }).click();
    
    // Should only show paid transactions
    await expect(page.getByText(/payé/i).first()).toBeVisible();
  });

  test('admin can view transaction details including sensitive data', async ({ page }) => {
    await page.getByRole('link', { name: /transactions/i }).click();
    
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

  test('admin validates seller completion', async ({ page }) => {
    await page.getByRole('link', { name: /transactions/i }).click();
    
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

  test('admin can force release funds on problematic transaction', async ({ page }) => {
    // Navigate to problematic transactions
    await page.getByRole('link', { name: /transactions problématiques/i }).click();
    
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

  test('admin can delete expired transaction', async ({ page }) => {
    await page.getByRole('link', { name: /transactions/i }).click();
    
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
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth');
    await page.getByLabel(/email/i).fill(TEST_ADMIN.email);
    await page.getByLabel(/mot de passe/i).fill(TEST_ADMIN.password);
    await page.getByRole('button', { name: /connexion/i }).click();
    await page.waitForURL('/dashboard/admin');
  });

  test('admin views all disputes in dashboard', async ({ page }) => {
    // Should see dispute stats
    await expect(page.getByText(/litiges ouverts/i)).toBeVisible();
    await expect(page.getByText(/litiges escaladés/i)).toBeVisible();
    
    // Navigate to disputes
    await page.getByRole('link', { name: /litiges/i }).click();
    
    // Should see all disputes
    await expect(page.getByRole('heading', { name: /tous les litiges/i })).toBeVisible();
    
    // Can filter by status
    await page.getByRole('tab', { name: /escaladés/i }).click();
    await expect(page.getByText(/escaladé/i).first()).toBeVisible();
  });

  test('admin creates official proposal for escalated dispute', async ({ page }) => {
    await page.getByRole('link', { name: /litiges/i }).click();
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

  test('admin can force escalate dispute', async ({ page }) => {
    await page.getByRole('link', { name: /litiges/i }).click();
    
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
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth');
    await page.getByLabel(/email/i).fill(TEST_ADMIN.email);
    await page.getByLabel(/mot de passe/i).fill(TEST_ADMIN.password);
    await page.getByRole('button', { name: /connexion/i }).click();
    await page.waitForURL('/dashboard/admin');
  });

  test('admin can view user profile with access logs', async ({ page }) => {
    await page.getByRole('link', { name: /utilisateurs/i }).click();
    
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

  test('admin access is logged in profile_access_logs', async ({ page }) => {
    await page.getByRole('link', { name: /utilisateurs/i }).click();
    await page.locator('[data-testid="user-row"]').first().click();
    
    // Admin viewing should create access log
    await expect(page.getByText(/accès administrateur enregistré/i)).toBeVisible();
    
    // Verify in activity logs
    await page.getByRole('link', { name: /logs d'activité/i }).click();
    await expect(page.getByText(/admin_profile_access/i)).toBeVisible();
  });

  test('admin cannot modify their own role', async ({ page }) => {
    // Navigate to admin settings
    await page.getByRole('button', { name: /menu utilisateur/i }).click();
    await page.getByRole('link', { name: /paramètres/i }).click();
    
    // Role management section should not allow self-modification
    const roleSelect = page.getByLabel(/rôle/i);
    await expect(roleSelect).toBeDisabled();
  });
});

test.describe('Admin Validation - Security & Audit', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth');
    await page.getByLabel(/email/i).fill(TEST_ADMIN.email);
    await page.getByLabel(/mot de passe/i).fill(TEST_ADMIN.password);
    await page.getByRole('button', { name: /connexion/i }).click();
    await page.waitForURL('/dashboard/admin');
  });

  test('admin dashboard shows security metrics', async ({ page }) => {
    // Should see security section
    await expect(page.getByText(/métriques de sécurité/i)).toBeVisible();
    
    // Should display key security stats
    await expect(page.getByText(/tentatives d'accès échouées/i)).toBeVisible();
    await expect(page.getByText(/tokens expirés/i)).toBeVisible();
    await expect(page.getByText(/disputes escaladés automatiquement/i)).toBeVisible();
  });

  test('admin can view complete activity logs', async ({ page }) => {
    await page.getByRole('link', { name: /logs d'activité/i }).click();
    
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
