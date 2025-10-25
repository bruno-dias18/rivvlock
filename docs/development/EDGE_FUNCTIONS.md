# 🔧 Edge Functions Documentation

## Overview
RivvLock uses Supabase Edge Functions (Deno runtime) for all backend operations. This document catalogs all 45+ functions with their purpose, inputs, and security model.

## 📁 Function Categories

### 🔐 Authentication & User Management
- `delete-user-account` - GDPR-compliant account deletion
- `export-user-data` - GDPR data export request
- `get-user-emails` - Fetch user emails (admin only)
- `clean-old-users` - Automated cleanup of unverified accounts (>30 days)

### 💳 Payment & Stripe
#### Customer Management
- `sync-stripe-customers` - Sync Supabase users with Stripe customers
- `create-stripe-customer` - Create customer on Stripe

#### Seller Onboarding
- `create-stripe-account` - Initialize Stripe Connect account
- `update-stripe-account-info` - Update seller's Stripe account
- `check-stripe-account-status` - Verify seller's account readiness
- `refresh-counterparty-stripe-status` - Update counterparty Stripe info
- `validate-stripe-accounts` - Batch validate Stripe accounts

#### Payment Intent & Capture
- `create-payment-intent` - Initialize escrow payment (on_behalf_of seller)
- `create-payment-checkout` - Create Stripe Checkout session
- `mark-payment-authorized` - Capture held funds after validation
- `sync-stripe-payments` - Sync payment statuses from Stripe

#### Transfers & Releases
- `process-automatic-transfer` - Transfer funds to seller (post-validation)
- `release-funds` - Manual admin fund release

### 📝 Transaction Lifecycle
#### Creation & Management
- `create-transaction` - Create new transaction
- `join-transaction` - Buyer joins via payment link
- `get-transaction-by-token` - Fetch transaction by secure token
- `admin-get-transaction` - Admin access to any transaction

#### Invoice System
- `generate-invoice-number` - Generate unique invoice number
- `get-invoice-data` - Fetch invoice data for PDF generation

#### Expiration & Renewal
- `delete-expired-transaction` - Delete expired draft transactions
- `renew-expired-transaction` - Renew expired transaction
- `process-expired-payment-deadlines` - Auto-expire unpaid transactions
- `process-validation-deadline` - Auto-complete after validation period

#### Date Changes
- `request-date-change` - Seller requests deadline change
- `respond-to-date-change` - Buyer approves/rejects date change

### ⚖️ Dispute System
#### Dispute Management
- `create-dispute` - Raise dispute during validation
- `respond-to-dispute` - Negotiate resolution
- `process-dispute` - Process dispute outcome
- `process-dispute-deadlines` - Auto-escalate unresolved disputes
- `admin-dispute-actions` - Admin force resolution

#### Proposals
- `create-proposal` - User creates resolution proposal
- `accept-proposal` - Accept resolution proposal
- `reject-proposal` - Reject resolution proposal
- `create-admin-proposal` - Admin creates official proposal
- `validate-admin-proposal` - User validates admin proposal

#### Messaging
- `mark-messages-read` - Mark dispute messages as read

### 🔔 Notifications & Reminders
- `send-notifications` - Send email notifications
- `send-validation-reminders` - Remind users of validation deadline

### 🔧 Maintenance & Fixes
- `fix-blocked-transaction` - Unblock stuck transactions (admin)
- `fix-reactivated-transactions` - Fix erroneously reactivated transactions
- `fix-resolved-disputes` - Cleanup resolved disputes
- `gdpr-data-retention-cleanup` - Automated GDPR data cleanup

### 📊 Reports
- `generate-annual-report` - Generate annual transaction report (ZIP)

## 🔒 Security Models

### Public Functions (verify_jwt = false)
```toml
[functions.get-transaction-by-token]
verify_jwt = false  # Uses secure token instead
```
- `get-transaction-by-token` - Token-based auth
- `join-transaction` - Public link access

### User Functions (verify_jwt = true)
Most functions require authenticated user:
```typescript
// Standard auth pattern
const authHeader = req.headers.get('Authorization')!;
const token = authHeader.replace('Bearer ', '');
const { data: { user } } = await supabaseClient.auth.getUser(token);
if (!user) throw new Error('Unauthorized');
```

### Admin Functions
Admin verification via RLS function:
```typescript
const { data: isAdmin } = await supabaseClient
  .rpc('get_current_user_admin_status');
if (!isAdmin) throw new Error('Admin access required');
```

## 📝 Common Patterns

### CORS Headers (All Functions)
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// OPTIONS handler
if (req.method === 'OPTIONS') {
  return new Response(null, { headers: corsHeaders });
}
```

### Error Handling
```typescript
try {
  // Business logic
  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  });
} catch (error) {
  console.error('[function-name] Error:', error);
  return new Response(JSON.stringify({ error: error.message }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 500,
  });
}
```

### Rate Limiting
```typescript
import { RateLimiter } from '../_shared/rate-limiter.ts';

const rateLimiter = new RateLimiter({
  maxRequests: 10,
  windowMs: 60000, // 1 minute
});

const isAllowed = await rateLimiter.checkLimit(user.id);
if (!isAllowed) {
  return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
    status: 429,
  });
}
```

### Input Validation
```typescript
import { validateInput } from '../_shared/validation.ts';
import { z } from 'https://deno.land/x/zod/mod.ts';

const schema = z.object({
  transaction_id: z.string().uuid(),
  amount: z.number().positive(),
});

const validatedData = validateInput(body, schema);
```

## 🔧 Shared Utilities

### `_shared/rate-limiter.ts`
In-memory rate limiting (resets on function cold start).

### `_shared/validation.ts`
Zod-based input validation helpers.

### `_shared/logger.ts`
Production-safe logging (silent in production).

## 📊 Function Call Frequencies

### High Frequency (called every action)
- `create-payment-intent` - On every transaction creation
- `mark-payment-authorized` - On buyer payment
- `get-transaction-by-token` - Payment link opens
- `sync-stripe-customers` - Auth state changes

### Medium Frequency (automated tasks)
- `process-validation-deadline` - Cron: every 5 minutes
- `process-expired-payment-deadlines` - Cron: every 5 minutes
- `process-dispute-deadlines` - Cron: daily
- `send-validation-reminders` - Cron: daily

### Low Frequency (admin/maintenance)
- `fix-blocked-transaction` - Manual admin action
- `release-funds` - Manual admin action
- `gdpr-data-retention-cleanup` - Cron: weekly
- `clean-old-users` - Cron: daily

## 🚨 Critical Functions (Require Testing)

### Payment Pipeline
1. `create-payment-intent` - Creates escrow
2. `mark-payment-authorized` - Captures funds
3. `process-validation-deadline` - Auto-completes
4. `process-automatic-transfer` - Transfers to seller

**Test Flow**: Create transaction → Pay → Wait validation → Verify transfer

### Dispute Pipeline
1. `create-dispute` - Opens dispute
2. `create-proposal` - User proposes resolution
3. `accept-proposal` / `reject-proposal` - Negotiation
4. `process-dispute-deadlines` - Auto-escalate
5. `create-admin-proposal` - Admin intervenes

**Test Flow**: Create dispute → Negotiate → Escalate → Admin resolve

## 🔗 External Dependencies

### Stripe API Calls
- Customer creation
- PaymentIntent creation/capture
- Transfers
- Account creation (Connect)

### Email Service
- Resend API for notifications
- Validation reminders
- Dispute notifications

## 🐛 Debugging Functions

### View Logs
```bash
# Local
supabase functions logs function-name

# Production (Lovable Cloud)
# Check edge function logs in Lovable dashboard
```

### Test Locally
```bash
supabase functions serve function-name --env-file .env.local
```

### Common Issues

**Issue**: Function returns 401  
**Fix**: Check Authorization header is passed correctly

**Issue**: Function times out  
**Fix**: Check database queries (missing indexes?)

**Issue**: CORS error  
**Fix**: Verify OPTIONS handler exists

## 📚 Best Practices

1. **Always validate inputs** with Zod schemas
2. **Use rate limiting** on public endpoints
3. **Never use raw SQL** - Use Supabase client methods
4. **Log errors** but not sensitive data
5. **Use transactions** for multi-step database operations
6. **Test payment flows** in Stripe test mode first
7. **Monitor function logs** in production

## 🔐 Security Checklist

- [ ] CORS headers present
- [ ] JWT verification (or token-based auth)
- [ ] Input validation with Zod
- [ ] Rate limiting on public endpoints
- [ ] No sensitive data in logs
- [ ] RLS policies enforce access control
- [ ] Admin actions require admin check
- [ ] Stripe operations use correct API keys

---

**Last updated:** October 13, 2025
