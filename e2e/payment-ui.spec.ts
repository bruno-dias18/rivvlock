import { test, expect } from '@playwright/test';

/**
 * Test simple de l'UI de paiement sans création d'utilisateurs
 * Teste directement les composants sur la page
 */
test.describe('Payment UI (Sans Auth)', () => {
  test('should display payment page loading state', async ({ page }) => {
    // Aller sur une page qui n'existe pas pour tester l'UI d'erreur
    await page.goto('/payment-link/test-token-inexistant');
    
    // Attendre que la page se charge
    await page.waitForLoadState('networkidle');
    
    // Vérifier qu'on a bien une page avec un message d'erreur ou de chargement
    const isError = await page.getByText(/erreur|error|oups|not found/i).isVisible().catch(() => false);
    const isLoading = await page.getByText(/chargement|loading/i).isVisible().catch(() => false);
    
    // Au moins un des deux devrait être visible
    expect(isError || isLoading).toBe(true);
  });

  test('should display rivvlock branding', async ({ page }) => {
    await page.goto('/payment-link/test-token-inexistant');
    await page.waitForLoadState('networkidle');
    
    // Vérifier la présence du logo RivvLock
    const logo = page.locator('img[alt*="RIVVLOCK" i], img[src*="rivvlock" i]');
    await expect(logo).toBeVisible();
  });

  test('should have proper page structure', async ({ page }) => {
    await page.goto('/payment-link/test-token-inexistant');
    await page.waitForLoadState('networkidle');
    
    // Vérifier la structure de base de la page
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('div')).toHaveCount.toBeGreaterThan(1);
  });
});

test.describe('App Navigation', () => {
  test('should navigate to home page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Vérifier qu'on arrive sur une page valide
    await expect(page.locator('body')).toBeVisible();
  });

  test('should navigate to auth page', async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('networkidle');
    
    // Vérifier qu'on a les éléments de connexion
    const hasEmailField = await page.getByLabel(/email/i).isVisible().catch(() => false);
    const hasPasswordField = await page.getByLabel(/mot de passe|password/i).isVisible().catch(() => false);
    
    expect(hasEmailField || hasPasswordField).toBe(true);
  });
});