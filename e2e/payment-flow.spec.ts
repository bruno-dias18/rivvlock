import { test, expect } from '@playwright/test';

/**
 * E2E tests for the complete payment flow
 * 
 * Critical user journey:
 * 1. User accesses payment link
 * 2. Selects payment method
 * 3. Redirects to Stripe or shows bank instructions
 * 4. Payment is processed
 */
test.describe('Payment Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the payment link page
    // Note: This would need a valid test transaction token
    await page.goto('/payment-link/test-token-123');
  });

  test('should display payment method selector', async ({ page }) => {
    // Wait for the page to load
    await page.waitForSelector('[data-testid="payment-method-selector"]');

    // Check that selector and option texts are visible
    const selector = page.locator('[data-testid="payment-method-selector"]');
    await expect(selector).toBeVisible();
    await expect(page.getByText(/carte bancaire/i)).toBeVisible();
    await expect(page.getByText(/virement bancaire/i)).toBeVisible();
  });

  test('should enable pay button only after selecting payment method', async ({ page }) => {
    // Wait for the page to load
    await page.waitForSelector('[data-testid="payment-method-selector"]');

    // Pay button should be disabled initially
    const payButton = page.getByRole('button', { name: /payer/i });
    await expect(payButton).toBeDisabled();

    // Select card payment method
    await page.getByText(/carte bancaire/i).click();

    // Pay button should now be enabled
    await expect(payButton).toBeEnabled();
  });

  test('should redirect to Stripe for card payment', async ({ page }) => {
    // Wait for the page to load
    await page.waitForSelector('[data-testid="payment-method-selector"]');

    // Select card payment method
    await page.getByText(/carte bancaire/i).click();

    // Click pay button
    const payButton = page.getByRole('button', { name: /payer/i });
    
    // Listen for navigation to Stripe
    const navigationPromise = page.waitForURL(/checkout\.stripe\.com/);
    
    await payButton.click();

    // Should redirect to Stripe checkout
    await navigationPromise;
    expect(page.url()).toContain('stripe.com');
  });

  test('should display bank transfer instructions', async ({ page }) => {
    // Wait for the page to load
    await page.waitForSelector('[data-testid="payment-method-selector"]');

    // Select bank transfer payment method
    await page.getByText(/virement bancaire/i).click();

    // Click pay button
    const payButton = page.getByRole('button', { name: /payer/i });
    await payButton.click();

    // Should display bank transfer instructions
    await expect(page.getByText(/instructions de virement/i)).toBeVisible();
  });

  test('should show transaction details', async ({ page }) => {
    // Wait for the page to load
    await page.waitForSelector('[data-testid="payment-method-selector"]');

    // Should display transaction information
    await expect(page.getByText(/montant/i)).toBeVisible();
    await expect(page.getByText(/vendeur/i)).toBeVisible();
    await expect(page.getByText(/description/i)).toBeVisible();
  });

  test('should handle expired payment links', async ({ page }) => {
    // Navigate to an expired payment link
    await page.goto('/payment-link/expired-token-123');

    // Should display error message
    await expect(page.getByText(/lien expiré/i)).toBeVisible();
  });
});

/**
 * Mobile-specific payment flow tests
 */
test.describe('Mobile Payment Flow', () => {
  test.use({ 
    viewport: { width: 375, height: 667 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
  });

  test('should display mobile-optimized payment selector', async ({ page }) => {
    await page.goto('/payment-link/test-token-123');
    await page.waitForSelector('[data-testid="payment-method-selector"]');

    // Check that layout is mobile-friendly
    const paymentSelector = page.locator('[data-testid="payment-method-selector"]');
    await expect(paymentSelector).toBeVisible();

    // Check that buttons are large enough for touch
    const cardButton = page.getByText(/carte bancaire/i);
    const box = await cardButton.boundingBox();
    expect(box?.height).toBeGreaterThan(40); // Minimum touch target size
  });
});
