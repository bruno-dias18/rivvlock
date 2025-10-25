# 🔧 Troubleshooting Guide - RivvLock

## Quick Navigation
- [Common Issues](#common-issues)
- [Payment Issues](#payment-issues)
- [Transaction Issues](#transaction-issues)
- [Dispute Issues](#dispute-issues)
- [Admin Issues](#admin-issues)
- [Development Issues](#development-issues)

---

## Common Issues

### Issue: User Can't Log In
**Symptoms**: "Invalid credentials" error or redirect loop

**Causes**:
1. Incorrect email/password
2. Email not verified
3. Site URL misconfigured in Supabase

**Solutions**:
```typescript
// Check Supabase Auth settings
1. Go to: https://supabase.com/dashboard/project/slthyxqruhfuyfmextwr/auth/url-configuration
2. Verify Site URL matches your domain
3. Add redirect URLs for all environments (preview, production, custom domain)
```

**Prevention**: Always verify email after registration

---

### Issue: "Transaction Not Found"
**Symptoms**: 404 error or empty transaction view

**Causes**:
1. User doesn't own the transaction (RLS blocking)
2. Transaction ID is incorrect
3. Transaction was deleted

**Solutions**:
```sql
-- Check transaction ownership
SELECT id, user_id, buyer_id, status 
FROM transactions 
WHERE id = 'transaction-id';

-- Verify user has access (should be seller OR buyer)
```

**Debug Steps**:
1. Check console logs for RLS policy errors
2. Verify user ID matches seller_id OR buyer_id
3. Check if transaction exists in database

---

### Issue: Payment Failed
**Symptoms**: "Payment processing failed" error

**Causes**:
1. Stripe account not set up (seller)
2. Card declined
3. Insufficient funds
4. Network timeout

**Solutions**:

**For Sellers**:
```typescript
// Check Stripe account status
const { data } = await supabase.functions.invoke('check-stripe-account-status');
// If not set up, complete onboarding
```

**For Buyers**:
- Try a different card
- Use Stripe test cards in test mode: `4242 4242 4242 4242`
- Check card has sufficient funds

**Check Logs**:
```bash
# Edge function logs
https://supabase.com/dashboard/project/slthyxqruhfuyfmextwr/functions/create-payment-intent/logs
```

---

## Payment Issues

### Issue: Funds Not Released Automatically
**Symptoms**: Transaction completed but seller hasn't received payment

**Diagnostic Checklist**:
```typescript
// 1. Check transaction status
status === 'completed' ? ✅ : ❌

// 2. Check payment_intent_status
payment_intent_status === 'requires_capture' ? ❌ Not captured yet
payment_intent_status === 'succeeded' ? ✅ Captured

// 3. Check if transfer was made
const { data } = await supabase
  .from('transactions')
  .select('stripe_transfer_id')
  .eq('id', transactionId)
  .single();

stripe_transfer_id ? ✅ Transfer made : ❌ Not transferred
```

**Manual Fix** (Admin only):
```typescript
// Release funds manually
await supabase.functions.invoke('release-funds', {
  body: { transaction_id: 'xxx' }
});
```

**Root Causes**:
- Edge function timeout during transfer
- Stripe API error
- Seller's Stripe account has issues

---

### Issue: Payment Deadline Passed
**Symptoms**: Transaction marked as expired, can't pay

**Expected Behavior**: This is correct - payment deadlines are enforced

**Solutions**:
1. **Renew the transaction** (if seller agrees)
2. **Create a new transaction** with extended deadline

**Renewal Process**:
```typescript
// Seller or buyer can renew
await supabase.functions.invoke('renew-expired-transaction', {
  body: {
    transaction_id: 'xxx',
    new_service_date: '2025-11-01',
    message: 'Extension requested'
  }
});
```

---

### Issue: Stripe Connect Onboarding Fails
**Symptoms**: "Error creating Stripe account" or onboarding loop

**Debug Steps**:
```typescript
// 1. Check if account already exists
const { data: profile } = await supabase
  .from('profiles')
  .select('stripe_account_id')
  .eq('user_id', user.id)
  .single();

// 2. If account exists, refresh status
await supabase.functions.invoke('check-stripe-account-status');

// 3. If stuck, create new account
// Delete old incomplete account from Stripe Dashboard first
```

**Common Causes**:
- Browser blocking popups (onboarding opens new tab)
- User closed onboarding before completion
- Network interruption

**Prevention**: Use incognito mode for testing, disable popup blockers

---

## Transaction Issues

### Issue: Can't Create Transaction
**Symptoms**: Form validation errors or creation fails

**Common Validation Errors**:
```typescript
// Price validation
Price must be ≥ €1.00 and ≤ €100,000
Format: 1234.56 (max 2 decimals)

// SIRET validation (France)
Must be exactly 14 digits
Example: 12345678901234

// AVS validation (Switzerland)
Format: 756.XXXX.XXXX.XX
Must pass Luhn algorithm

// Service date validation
Must be at least 1 day in the future
```

**Solutions**:
- Use correct format for business identifiers
- Check price is within limits
- Ensure service date is future date

---

### Issue: Transaction Stuck in "Payment Authorized"
**Symptoms**: Buyer paid, but transaction not in validation period

**Diagnostic**:
```typescript
// Check status
const { data: tx } = await supabase
  .from('transactions')
  .select('status, payment_intent_status, service_date')
  .eq('id', txId)
  .single();

console.log({
  status: tx.status, // Should be 'validation_period'
  payment: tx.payment_intent_status, // Should be 'succeeded'
  serviceDate: tx.service_date // Should be in past
});
```

**Causes**:
1. Service date is still in future
2. Payment intent not captured properly
3. Cron job not running

**Manual Fix** (Admin):
```typescript
// Force validation period
await supabase.functions.invoke('fix-blocked-transaction', {
  body: { transaction_id: 'xxx' }
});
```

---

### Issue: Date Change Request Not Working
**Symptoms**: Request submitted but nothing happens

**Check**:
```typescript
// View pending date change
const { data } = await supabase
  .from('date_change_requests')
  .select('*')
  .eq('transaction_id', txId)
  .eq('status', 'pending');

// Counterparty must approve/reject
```

**Notes**:
- Only seller can request date changes
- Buyer must approve before change takes effect
- Only 1 pending request allowed per transaction

---

## Dispute Issues

### Issue: Can't Create Dispute
**Symptoms**: "Cannot create dispute" error

**Requirements Checklist**:
```typescript
✅ Transaction status === 'validation_period'
✅ No existing dispute for this transaction
✅ User is buyer OR seller
✅ Validation period not ended yet
```

**Common Mistakes**:
- Trying to dispute after validation period
- Multiple dispute attempts (1 per transaction max)
- Transaction not paid yet

---

### Issue: Dispute Messages Not Sending
**Symptoms**: Message appears to send but doesn't show up

**Check Message Limit**:
```typescript
// Each dispute has 100 message limit
const { count } = await supabase
  .from('dispute_messages')
  .select('*', { count: 'exact', head: true })
  .eq('dispute_id', disputeId);

console.log(`${count}/100 messages used`);
```

**If limit reached**: Escalate to admin for official proposal

---

### Issue: Proposal Not Working
**Symptoms**: Proposal created but can't accept/reject

**Debug**:
```typescript
// Check proposal status
const { data } = await supabase
  .from('dispute_proposals')
  .select('*')
  .eq('dispute_id', disputeId)
  .order('created_at', { ascending: false })
  .limit(1);

console.log({
  status: data[0].status, // Should be 'pending'
  proposedBy: data[0].proposed_by_user_id,
  refund: data[0].refund_percentage
});
```

**Requirements**:
- Only counterparty can accept/reject
- Only 1 pending proposal at a time
- Refund must be 0-100%

---

## Admin Issues

### Issue: Can't Access Admin Pages
**Symptoms**: 403 error or redirect to dashboard

**Check Admin Status**:
```sql
-- Run in Supabase SQL Editor
SELECT 
  p.user_id,
  p.email,
  p.is_admin
FROM profiles p
WHERE p.user_id = 'your-user-id';
```

**Grant Admin Access** (Database only):
```sql
UPDATE profiles 
SET is_admin = true 
WHERE user_id = 'user-id';
```

**Security Note**: Admin status can ONLY be set via database, not through app

---

### Issue: Admin Actions Not Working
**Symptoms**: "Admin access required" error despite being admin

**Causes**:
1. RLS cache not updated
2. Session expired
3. Admin flag not properly set

**Solutions**:
```typescript
// 1. Force logout and re-login
await supabase.auth.signOut();

// 2. Verify admin status via RPC
const { data } = await supabase.rpc('get_current_user_admin_status');
console.log('Is admin:', data);

// 3. Clear browser cache and retry
```

---

## Development Issues

### Issue: Edge Function Not Deploying
**Symptoms**: Function not showing in Supabase dashboard

**Checklist**:
```bash
✅ Function is in supabase/functions/{name}/
✅ index.ts file exists
✅ config.toml includes function
✅ No syntax errors in index.ts
```

**Manual Deploy** (if needed):
```bash
supabase functions deploy function-name
```

---

### Issue: TypeScript Build Errors
**Symptoms**: Can't build or type errors in console

**Common Fixes**:
```typescript
// 1. Check for missing imports
import { supabase } from '@/integrations/supabase/client';

// 2. Verify types match database schema
// Types auto-generated in: src/integrations/supabase/types.ts

// 3. Clear cache and rebuild
rm -rf node_modules
npm install
npm run build
```

---

### Issue: Sentry Not Capturing Errors
**Symptoms**: Errors not showing in Sentry dashboard

**Debug**:
```typescript
// 1. Check DSN is set
console.log(import.meta.env.VITE_SENTRY_DSN ? '✅ Set' : '❌ Missing');

// 2. Verify environment
console.log(import.meta.env.MODE); // Must be 'production'

// 3. Test manually
import { captureException } from '@/lib/sentry';
captureException(new Error('Test error'));
```

**Common Causes**:
- VITE_SENTRY_DSN not set in .env
- Running in development mode
- Sentry init failed silently

---

## Performance Issues

### Issue: Slow Transaction List Loading
**Symptoms**: Page takes >3s to load transactions

**Solutions**:
```typescript
// 1. Check number of transactions
const { count } = await supabase
  .from('transactions')
  .select('*', { count: 'exact', head: true });

// If >500 transactions, implement pagination

// 2. Use virtual scrolling (already installed)
import { VirtualTransactionList } from '@/components/VirtualTransactionList';

// 3. Add database indexes (already done for most queries)
```

---

### Issue: High Memory Usage
**Symptoms**: Browser slows down or crashes

**Causes**:
- Too many realtime subscriptions
- Large images not optimized
- Memory leaks in useEffect

**Solutions**:
```typescript
// 1. Clean up subscriptions
useEffect(() => {
  const channel = supabase.channel('...');
  
  return () => {
    supabase.removeChannel(channel);
  };
}, []);

// 2. Limit realtime listeners
// Only subscribe to active transactions

// 3. Optimize images
// Use CDN or image optimization service
```

---

## Database Issues

### Issue: RLS Policy Blocking Valid Access
**Symptoms**: "Permission denied" despite user owning resource

**Debug**:
```sql
-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'transactions';

-- Test query with service_role (bypasses RLS)
-- Use Supabase dashboard SQL editor

-- Verify user_id matches
SELECT 
  t.id,
  t.user_id as seller_id,
  t.buyer_id,
  auth.uid() as current_user
FROM transactions t
WHERE t.id = 'transaction-id';
```

**Common Mistakes**:
- Using wrong user ID field
- Missing `OR` in RLS policy
- Forgetting to enable RLS on new tables

---

## Getting Help

### Before Asking for Help

1. **Check error logs**:
   - Browser console
   - Supabase edge function logs
   - Sentry dashboard

2. **Reproduce the issue**:
   - Document exact steps
   - Note when it started happening
   - Test in incognito mode

3. **Gather context**:
   - User ID
   - Transaction/dispute ID
   - Timestamp
   - Browser/device info

### Support Channels

- **Development**: Check `DEVELOPER_GUIDE.md`
- **Architecture**: See `ARCHITECTURE.md`
- **Edge Functions**: Review `EDGE_FUNCTIONS.md`
- **Security**: Read `SECURITY_AUDIT_REPORT_FINAL.md`

### Reporting Bugs

Use this template:
```markdown
**Issue**: [Brief description]

**Steps to Reproduce**:
1. 
2. 
3. 

**Expected**: [What should happen]
**Actual**: [What actually happens]

**Environment**:
- Browser: 
- User ID: 
- Transaction ID (if applicable): 

**Logs**:
```
[Paste relevant console/Sentry errors]
```
```

---

**Last Updated**: October 13, 2025  
**Version**: 1.0
