# 🧪 Plan de Testing Complet - RivvLock

**Date** : 18 Octobre 2025  
**Objectif** : Couvrir 100% des chemins critiques  

---

## 📋 Vue d'Ensemble Testing

| Type Test | Coverage Actuel | Target | Priorité |
|-----------|----------------|--------|----------|
| **Unit Tests** | 65% | 85% | 🔴 HIGH |
| **Integration Tests** | 40% | 70% | 🟡 MEDIUM |
| **E2E Tests** | 0% | 90% | 🔴 HIGH |
| **Performance Tests** | 0% | 100% | 🟡 MEDIUM |
| **Security Tests** | 80% | 100% | 🔴 HIGH |

---

## 🎯 1. TESTS UNITAIRES (Unit Tests)

### 1.1 Hooks - Priorité CRITIQUE

#### ✅ Déjà Testés (src/hooks/__tests__/)
```typescript
✅ useTransactions.test.tsx
✅ useDisputes.test.tsx
✅ useProfile.test.tsx
✅ useStripeAccount.test.tsx
✅ useAdminStats.test.tsx
```

#### ❌ À Créer

**usePayment.test.tsx**
```typescript
describe('usePayment', () => {
  test('should create payment checkout session', async () => {
    const { result } = renderHook(() => usePayment());
    
    await act(async () => {
      await result.current.createCheckout(transactionId);
    });
    
    expect(result.current.checkoutUrl).toBeTruthy();
  });
  
  test('should handle payment error gracefully', async () => {
    // Mock Stripe error
    vi.mocked(supabase.functions.invoke).mockRejectedValue(
      new Error('Payment failed')
    );
    
    const { result } = renderHook(() => usePayment());
    await expect(result.current.createCheckout(id)).rejects.toThrow();
  });
});
```

**useQuotes.test.tsx**
```typescript
describe('useQuotes', () => {
  test('should fetch seller quotes', async () => {
    const { result } = renderHook(() => useQuotes());
    
    await waitFor(() => {
      expect(result.current.quotes).toHaveLength(3);
    });
  });
  
  test('should create new quote', async () => {
    const { result } = renderHook(() => useQuotes());
    
    await act(async () => {
      await result.current.createQuote(quoteData);
    });
    
    expect(result.current.quotes).toContainEqual(
      expect.objectContaining({ title: quoteData.title })
    );
  });
});
```

**useConversation.test.tsx**
```typescript
describe('useConversation', () => {
  test('should load conversation messages', async () => {
    const { result } = renderHook(() => 
      useConversation(conversationId)
    );
    
    await waitFor(() => {
      expect(result.current.messages).toHaveLength(5);
    });
  });
  
  test('should send message', async () => {
    const { result } = renderHook(() => 
      useConversation(conversationId)
    );
    
    await act(async () => {
      await result.current.sendMessage('Hello');
    });
    
    expect(result.current.messages).toContainEqual(
      expect.objectContaining({ message: 'Hello' })
    );
  });
});
```

---

### 1.2 Composants - Priorité HAUTE

#### ❌ À Créer

**PaymentMethodSelector.test.tsx**
```typescript
describe('PaymentMethodSelector', () => {
  test('should render payment methods', () => {
    render(<PaymentMethodSelector />);
    
    expect(screen.getByText('Carte bancaire')).toBeInTheDocument();
    expect(screen.getByText('Virement bancaire')).toBeInTheDocument();
  });
  
  test('should select payment method', () => {
    const onSelect = vi.fn();
    render(<PaymentMethodSelector onSelect={onSelect} />);
    
    fireEvent.click(screen.getByText('Carte bancaire'));
    expect(onSelect).toHaveBeenCalledWith('card');
  });
  
  test('should disable button until method selected', () => {
    render(<PaymentMethodSelector />);
    
    const button = screen.getByRole('button', { name: /payer/i });
    expect(button).toBeDisabled();
    
    fireEvent.click(screen.getByText('Carte bancaire'));
    expect(button).toBeEnabled();
  });
});
```

**TransactionCard.test.tsx**
```typescript
describe('TransactionCard', () => {
  test('should display transaction info', () => {
    const transaction = createMockTransaction();
    render(<TransactionCard transaction={transaction} />);
    
    expect(screen.getByText(transaction.title)).toBeInTheDocument();
    expect(screen.getByText(`${transaction.price} €`)).toBeInTheDocument();
  });
  
  test('should show payment button if awaiting payment', () => {
    const transaction = createMockTransaction({ status: 'awaiting_payment' });
    render(<TransactionCard transaction={transaction} />);
    
    expect(screen.getByText(/payer/i)).toBeInTheDocument();
  });
  
  test('should show validation buttons if paid', () => {
    const transaction = createMockTransaction({ status: 'paid' });
    render(<TransactionCard transaction={transaction} />);
    
    expect(screen.getByText(/valider/i)).toBeInTheDocument();
  });
});
```

**QuoteCard.test.tsx**
```typescript
describe('QuoteCard', () => {
  test('should display quote details', () => {
    const quote = createMockQuote();
    render(<QuoteCard quote={quote} />);
    
    expect(screen.getByText(quote.title)).toBeInTheDocument();
    expect(screen.getByText(`${quote.total_amount} €`)).toBeInTheDocument();
  });
  
  test('should show accept button for client', () => {
    const quote = createMockQuote({ status: 'pending' });
    const { container } = render(
      <QuoteCard quote={quote} isClient={true} />
    );
    
    expect(screen.getByText(/accepter/i)).toBeInTheDocument();
  });
});
```

---

### 1.3 Utilitaires (lib/) - Priorité MOYENNE

#### ❌ À Créer

**paymentUtils.test.ts**
```typescript
describe('Payment Utils', () => {
  test('calculateFees should compute correct fees', () => {
    const amount = 100;
    const feeRatio = 5; // 5%
    
    const fees = calculateFees(amount, feeRatio);
    expect(fees).toBe(5);
  });
  
  test('validatePaymentAmount should reject negative', () => {
    expect(() => validatePaymentAmount(-10)).toThrow();
  });
  
  test('formatCurrency should format EUR correctly', () => {
    expect(formatCurrency(1234.56, 'EUR')).toBe('1 234,56 €');
  });
});
```

**dateUtils.test.ts**
```typescript
describe('Date Utils', () => {
  test('isPaymentDeadlinePassed should work', () => {
    const pastDate = new Date('2025-01-01');
    expect(isPaymentDeadlinePassed(pastDate)).toBe(true);
    
    const futureDate = new Date('2026-01-01');
    expect(isPaymentDeadlinePassed(futureDate)).toBe(false);
  });
  
  test('calculateValidationDeadline should add 14 days', () => {
    const serviceDate = new Date('2025-10-01');
    const deadline = calculateValidationDeadline(serviceDate);
    
    expect(deadline).toEqual(new Date('2025-10-15'));
  });
});
```

---

## 🔗 2. TESTS INTÉGRATION (Integration Tests)

### 2.1 Flows Backend (Edge Functions)

**Test Payment Flow**
```typescript
describe('Payment Flow Integration', () => {
  test('Complete payment with Stripe', async () => {
    // 1. Create transaction
    const { data: tx } = await supabase.functions.invoke(
      'create-transaction',
      { body: { title: 'Test', price: 100 } }
    );
    
    // 2. Create checkout
    const { data: checkout } = await supabase.functions.invoke(
      'create-payment-checkout',
      { body: { transactionId: tx.id } }
    );
    
    expect(checkout.url).toContain('stripe.com');
    
    // 3. Simulate webhook success
    await supabase.functions.invoke('stripe-webhook', {
      body: createStripeSuccessEvent(tx.id)
    });
    
    // 4. Verify status updated
    const { data: updated } = await supabase
      .from('transactions')
      .select('status')
      .eq('id', tx.id)
      .single();
    
    expect(updated.status).toBe('payment_authorized');
  });
});
```

**Test Dispute Flow**
```typescript
describe('Dispute Flow Integration', () => {
  test('Create dispute and escalate', async () => {
    // Setup: transaction paid
    const tx = await createPaidTransaction();
    
    // 1. Create dispute
    const { data: dispute } = await supabase.functions.invoke(
      'create-dispute',
      { body: { transactionId: tx.id, reason: 'Quality issue' } }
    );
    
    // 2. Respond to dispute
    await supabase.functions.invoke('respond-to-dispute', {
      body: { disputeId: dispute.id, message: 'I disagree' }
    });
    
    // 3. Wait deadline pass (mock time)
    vi.setSystemTime(new Date('2025-12-01'));
    
    // 4. Run cron job
    await supabase.functions.invoke('process-dispute-deadlines');
    
    // 5. Verify escalated
    const { data: updated } = await supabase
      .from('disputes')
      .select('status')
      .eq('id', dispute.id)
      .single();
    
    expect(updated.status).toBe('escalated');
  });
});
```

---

## 🌐 3. TESTS E2E (End-to-End)

### 3.1 Setup Playwright

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://localhost:5173',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'] } },
  ],
});
```

---

### 3.2 Scénarios E2E Critiques

**E2E-001: Complete Transaction Flow**
```typescript
test('Complete transaction creation and payment', async ({ page }) => {
  // 1. Login
  await page.goto('/auth');
  await page.fill('input[name="email"]', 'seller@test.com');
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  
  await expect(page).toHaveURL('/dashboard');
  
  // 2. Create transaction
  await page.click('a:has-text("Transactions")');
  await page.click('button:has-text("Nouvelle")');
  
  await page.fill('input[name="title"]', 'E2E Test Transaction');
  await page.fill('input[name="price"]', '150');
  await page.fill('input[name="client_email"]', 'buyer@test.com');
  await page.click('button:has-text("Créer")');
  
  // 3. Verify created
  await expect(page.locator('text=E2E Test Transaction')).toBeVisible();
  
  // 4. Copy link
  const linkButton = page.locator('[data-testid="share-link"]');
  await linkButton.click();
  
  // 5. Open in new context (buyer)
  const buyerContext = await browser.newContext();
  const buyerPage = await buyerContext.newPage();
  
  const link = await page.locator('[data-testid="payment-link"]').textContent();
  await buyerPage.goto(link);
  
  // 6. Join transaction
  await buyerPage.fill('input[name="first_name"]', 'Buyer');
  await buyerPage.fill('input[name="last_name"]', 'Test');
  await buyerPage.click('button:has-text("Rejoindre")');
  
  // 7. Select payment method
  await buyerPage.click('[data-testid="payment-method-card"]');
  await buyerPage.click('button:has-text("Payer")');
  
  // 8. Verify redirected to Stripe
  await expect(buyerPage).toHaveURL(/stripe\.com|checkout\.stripe\.com/);
});
```

**E2E-002: Quote to Transaction Conversion**
```typescript
test('Create quote and convert to transaction', async ({ page }) => {
  await loginAs(page, 'seller@test.com');
  
  // 1. Create quote
  await page.goto('/quotes');
  await page.click('button:has-text("Nouveau devis")');
  
  await page.fill('input[name="title"]', 'E2E Quote');
  await page.fill('input[name="client_email"]', 'client@test.com');
  await page.click('button:has-text("Ajouter ligne")');
  await page.fill('input[name="items.0.description"]', 'Service A');
  await page.fill('input[name="items.0.quantity"]', '2');
  await page.fill('input[name="items.0.unit_price"]', '50');
  
  await page.click('button:has-text("Créer devis")');
  
  // 2. Share quote
  const token = await page.locator('[data-testid="quote-token"]').textContent();
  
  // 3. Client accepts
  const clientContext = await browser.newContext();
  const clientPage = await clientContext.newPage();
  await clientPage.goto(`/quote/${token}`);
  
  await clientPage.click('button:has-text("Accepter")');
  
  // 4. Verify transaction created
  await page.reload();
  await page.goto('/transactions');
  await expect(page.locator('text=E2E Quote')).toBeVisible();
});
```

**E2E-003: Dispute Creation and Resolution**
```typescript
test('Create and resolve dispute', async ({ page }) => {
  // Setup: transaction paid
  const tx = await createPaidTransactionViaAPI();
  
  // 1. Login as buyer
  await loginAs(page, 'buyer@test.com');
  
  // 2. Navigate to transaction
  await page.goto('/transactions');
  await page.click(`[data-testid="transaction-${tx.id}"]`);
  
  // 3. Create dispute
  await page.click('button:has-text("Créer un litige")');
  await page.selectOption('select[name="dispute_type"]', 'quality_issue');
  await page.fill('textarea[name="reason"]', 'Service non conforme');
  await page.click('button[type="submit"]');
  
  // 4. Verify dispute created
  await expect(page.locator('text=Litige créé')).toBeVisible();
  
  // 5. Seller responds
  const sellerContext = await browser.newContext();
  const sellerPage = await sellerContext.newPage();
  await loginAs(sellerPage, 'seller@test.com');
  
  await sellerPage.goto('/disputes');
  await sellerPage.click(`[data-testid="dispute-${tx.id}"]`);
  await sellerPage.fill('textarea[name="message"]', 'Je propose un remboursement 50%');
  await sellerPage.click('button:has-text("Envoyer proposition")');
  
  // 6. Buyer accepts
  await page.reload();
  await page.click('button:has-text("Accepter la proposition")');
  
  // 7. Verify resolved
  await expect(page.locator('text=Litige résolu')).toBeVisible();
});
```

**E2E-004: Mobile Payment Flow**
```typescript
test.use({ viewport: { width: 375, height: 667 } }); // iPhone

test('Mobile payment experience', async ({ page }) => {
  await page.goto('/payment-link/test-token');
  
  // 1. Verify mobile layout
  await expect(page.locator('[data-testid="mobile-layout"]')).toBeVisible();
  
  // 2. Select payment method
  await page.click('[data-testid="payment-method-card"]');
  
  // 3. Pay button
  await page.click('button:has-text("Payer")');
  
  // 4. Verify Stripe mobile view
  await expect(page).toHaveURL(/stripe\.com/);
  
  // 5. Verify responsive elements
  const cardInput = page.locator('input[name="cardNumber"]');
  await expect(cardInput).toBeVisible();
});
```

---

## ⚡ 4. TESTS PERFORMANCE

### 4.1 Lighthouse Audit

```bash
# lighthouse-ci.yml
ci:
  collect:
    numberOfRuns: 3
  assert:
    assertions:
      performance: ['error', { minScore: 0.9 }]
      accessibility: ['warn', { minScore: 0.9 }]
      seo: ['warn', { minScore: 0.9 }]
  upload:
    target: 'temporary-public-storage'
```

### 4.2 Load Testing (k6)

```javascript
// tests/performance/transaction-load.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '30s', target: 20 },  // Warm up
    { duration: '1m', target: 50 },   // Normal load
    { duration: '2m', target: 100 },  // Peak load
    { duration: '30s', target: 0 },   // Cool down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% requests < 500ms
    http_req_failed: ['rate<0.01'],   // < 1% errors
  },
};

export default function () {
  // Test GET transactions
  let res = http.get('https://app.rivvlock.com/api/transactions', {
    headers: { 'Authorization': `Bearer ${__ENV.AUTH_TOKEN}` },
  });
  
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 300ms': (r) => r.timings.duration < 300,
    'has transactions': (r) => JSON.parse(r.body).length > 0,
  });
  
  sleep(1);
}
```

**Métriques à valider :**
- ⚡ P50 response time : < 150ms
- ⚡ P95 response time : < 300ms
- ⚡ P99 response time : < 500ms
- ⚡ Error rate : < 1%
- ⚡ Throughput : > 100 req/s

---

## 🔐 5. TESTS SÉCURITÉ

### 5.1 Tests Manuels RLS

**Test Isolation Transactions**
```sql
-- User A essaye d'accéder transaction User B
SET request.jwt.claims = '{"sub": "user-a-uuid"}';

SELECT * FROM transactions WHERE id = 'user-b-transaction-id';
-- ✅ Doit retourner 0 lignes

-- Admin peut accéder
SET request.jwt.claims = '{"sub": "admin-uuid", "role": "admin"}';
SELECT * FROM transactions WHERE id = 'user-b-transaction-id';
-- ✅ Doit retourner 1 ligne
```

**Test Bypass Messages**
```sql
-- User C (non participant) essaye lire conversation
SET request.jwt.claims = '{"sub": "user-c-uuid"}';

SELECT * FROM messages WHERE conversation_id = 'conversation-ab';
-- ✅ Doit retourner 0 lignes
```

### 5.2 Tests Automatisés Sécurité

```typescript
describe('Security Tests', () => {
  test('RLS: Cannot access other user transactions', async () => {
    const userA = await createUser('a@test.com');
    const userB = await createUser('b@test.com');
    
    const txB = await createTransaction(userB.id);
    
    // Try access as user A
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', txB.id)
      .setAuth(userA.token);
    
    expect(data).toHaveLength(0);
    expect(error).toBeTruthy();
  });
  
  test('XSS: Script tags escaped in messages', async () => {
    const message = '<script>alert("XSS")</script>';
    
    const { data } = await supabase
      .from('messages')
      .insert({ message, conversation_id: 'test' })
      .select();
    
    // Verify escaped
    expect(data[0].message).not.toContain('<script>');
    expect(data[0].message).toContain('&lt;script&gt;');
  });
  
  test('Rate Limiting: Block after 10 failed attempts', async () => {
    const token = 'invalid-token';
    
    // Try 11 times
    for (let i = 0; i < 11; i++) {
      await supabase.functions.invoke('get-transaction-by-token', {
        body: { token }
      });
    }
    
    // 11th should be blocked
    const { error } = await supabase.functions.invoke(
      'get-transaction-by-token',
      { body: { token } }
    );
    
    expect(error.message).toContain('Rate limit');
  });
});
```

---

## 📊 6. COVERAGE DASHBOARD

### 6.1 Configuration Vitest

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/integrations/supabase/types.ts',
        '**/*.test.{ts,tsx}',
      ],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 80,
        statements: 85,
      },
    },
  },
});
```

### 6.2 CI/CD Integration

```yaml
# .github/workflows/tests.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      
      - name: Install
        run: npm ci
      
      - name: Unit Tests
        run: npm run test:coverage
      
      - name: E2E Tests
        run: npx playwright test
      
      - name: Upload Coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/coverage-final.json
```

---

## ✅ CHECKLIST FINALE TESTING

### Unit Tests
- [ ] 85%+ coverage atteint
- [ ] Tous les hooks testés
- [ ] Composants critiques testés
- [ ] Utils testés

### E2E Tests
- [ ] 7 scénarios critiques passent
- [ ] Tests mobile OK
- [ ] Screenshots échecs activés
- [ ] CI/CD configuré

### Performance
- [ ] Lighthouse > 90
- [ ] k6 load test passé
- [ ] P95 < 300ms

### Sécurité
- [ ] RLS testé manuellement
- [ ] XSS/injection testés
- [ ] Rate limiting vérifié
- [ ] Audit pénétration fait

---

**Document créé le : 18 Octobre 2025**  
**Version : 1.0**  
**Temps estimé tests : 60 heures**
