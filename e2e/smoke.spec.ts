import { test, expect } from '@playwright/test';

// Minimal smoke test to validate app boots and auth page renders
// This does not require backend data and should pass deterministically

test.describe('Smoke', () => {
  test('app boots and auth form is visible', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/auth');

    // Wait for at least one key control of the auth form
    await expect(page.getByLabel(/email/i)).toBeVisible({ timeout: 30000 });
    await expect(page.getByLabel(/mot de passe/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /(connexion|se connecter)/i })).toBeVisible();
  });
});
