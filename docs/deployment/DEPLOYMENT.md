# 🚀 Deployment Guide - RivvLock

## Pre-Deployment Checklist

### 1. Code Quality
- [ ] All tests passing (`npm run test`)
- [ ] TypeScript compiles without errors (`npm run build`)
- [ ] No console warnings in production build
- [ ] Code review completed
- [ ] Security audit passed (see `SECURITY_AUDIT_REPORT_FINAL.md`)

### 2. Environment Variables
Required environment variables for production:

```bash
# Supabase
VITE_SUPABASE_URL=https://slthyxqruhfuyfmextwr.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Sentry (Error Tracking)
VITE_SENTRY_DSN=https://your-dsn@sentry.io/your-project

# Production Mode
NODE_ENV=production
VITE_APP_ENV=production
```

### 3. Supabase Configuration

#### Authentication URLs
Configure in Supabase Dashboard → Authentication → URL Configuration:

```
Site URL: https://app.rivvlock.com
Redirect URLs:
- https://app.rivvlock.com
- https://app.rivvlock.com/auth
- https://app.rivvlock.com/payment-success
- https://preview-your-project.lovable.app (for testing)
```

#### Edge Functions Secrets
Set in Supabase Dashboard → Edge Functions → Secrets:

```bash
STRIPE_SECRET_KEY=sk_live_...
RESEND_API_KEY=re_...
```

#### Database
- [ ] All migrations applied
- [ ] RLS policies enabled on all tables
- [ ] Indexes created for performance
- [ ] Backup schedule configured

### 4. Stripe Configuration

#### Live Mode Setup
1. Switch to Live Mode in Stripe Dashboard
2. Complete account verification
3. Configure webhooks (optional, but recommended):
   ```
   Endpoint: https://slthyxqruhfuyfmextwr.supabase.co/functions/v1/stripe-webhook
   Events: payment_intent.succeeded, charge.dispute.created, etc.
   ```

#### Application Settings
- [ ] Business name and branding configured
- [ ] Support contact information updated
- [ ] Connect settings reviewed
- [ ] Payout schedule configured

### 5. Monitoring

#### Sentry Setup
1. Create production environment in Sentry
2. Copy DSN to `VITE_SENTRY_DSN`
3. Configure alerts:
   - Critical errors → Instant notification
   - Error rate > 1% → Alert
   - Session replay enabled

#### Supabase Monitoring
- [ ] Enable database backups (daily)
- [ ] Set up log retention (30 days minimum)
- [ ] Configure alerts for edge function errors
- [ ] Monitor database performance metrics

---

## Deployment Process

### Option 1: Lovable Hosting (Recommended)

#### 1. Deploy to Preview
```bash
# Automatic on every git push
git push origin main
```

#### 2. Test Preview Environment
- Visit preview URL
- Run smoke tests
- Check Sentry for errors
- Verify payments work (test mode)

#### 3. Deploy to Production
```bash
# Click "Publish" button in Lovable dashboard
# Or use CLI:
lovable deploy --production
```

### Option 2: Custom Hosting (Vercel, Netlify, etc.)

#### Build
```bash
npm run build
# Output in dist/
```

#### Deploy
```bash
# Vercel
vercel --prod

# Netlify
netlify deploy --prod --dir=dist

# Custom server
rsync -avz dist/ user@server:/var/www/rivvlock/
```

---

## Post-Deployment

### 1. Smoke Tests
Run these tests immediately after deployment:

```bash
# Authentication
✓ Register new account
✓ Login with existing account
✓ Logout and re-login

# Transactions
✓ Create new transaction
✓ Share payment link
✓ Complete payment (test card)
✓ Validate transaction
✓ Download invoice

# Disputes
✓ Create dispute
✓ Send message
✓ Create proposal
✓ Accept/reject proposal

# Admin
✓ Access admin dashboard
✓ View all transactions
✓ Manage disputes
✓ Release funds manually
```

### 2. Monitoring Checklist
- [ ] Sentry receiving error reports
- [ ] Database queries performing well (<100ms avg)
- [ ] Edge functions responding (<500ms avg)
- [ ] No 4xx/5xx errors in logs
- [ ] Email notifications working

### 3. User Communication
If updating existing production:

**Email Template:**
```
Subject: RivvLock Platform Update

Bonjour,

Nous avons déployé une mise à jour de RivvLock incluant :
- [Liste des améliorations]
- [Corrections de bugs]

Si vous rencontrez des problèmes, contactez-nous :
contact@rivvlock.com

Merci de votre confiance,
L'équipe RivvLock
```

---

## Rollback Procedure

### If Critical Issues Occur

#### Immediate Actions
1. **Revert to previous version**:
   ```bash
   # Lovable
   lovable deploy --version [previous-version]
   
   # Vercel
   vercel rollback
   ```

2. **Check Sentry for errors**:
   - Identify root cause
   - Note affected users
   - Document incident

3. **Communicate with users**:
   - Status page update
   - Email notification if needed

#### Database Rollback
⚠️ **CAUTION**: Only if absolutely necessary

```sql
-- Revert last migration
-- Contact Supabase support if needed
```

---

## Performance Optimization

### Frontend
- [ ] Enable Vite build optimizations
- [ ] Configure code splitting
- [ ] Lazy load heavy components
- [ ] Optimize images (WebP, sizes)
- [ ] Enable service worker caching

### Backend
- [ ] Add database indexes for slow queries
- [ ] Optimize edge function cold starts
- [ ] Enable database connection pooling
- [ ] Configure CDN for static assets

### Monitoring Targets
- **Page Load**: <2s (First Contentful Paint)
- **API Response**: <500ms (p95)
- **Database Queries**: <100ms (p95)
- **Uptime**: >99.9%

---

## Security Post-Deployment

### 1. Verify Security Headers
Check using [SecurityHeaders.com](https://securityheaders.com):

```bash
curl -I https://app.rivvlock.com
```

Expected headers:
- `Strict-Transport-Security: max-age=31536000`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Content-Security-Policy: ...`

### 2. SSL Certificate
- [ ] Valid SSL certificate installed
- [ ] Certificate expiry monitored
- [ ] HTTPS redirect configured
- [ ] Mixed content warnings resolved

### 3. API Keys
- [ ] All test keys replaced with live keys
- [ ] Secrets rotated if exposed
- [ ] Access logs reviewed
- [ ] Rate limiting configured

---

## Scaling Considerations

### When to Scale

#### Database
- >80% CPU usage sustained
- Query times >100ms avg
- >1000 connections

**Actions**:
1. Upgrade Supabase tier
2. Add read replicas
3. Implement caching (Redis)

#### Edge Functions
- Cold start times >1s
- Timeout errors increasing
- >10k requests/min

**Actions**:
1. Optimize function code
2. Increase timeout limits
3. Add function instances

### Traffic Projections

| Users | Transactions/day | DB Size | Bandwidth |
|-------|-----------------|---------|-----------|
| 1,000 | 50 | 10 GB | 100 GB/mo |
| 10,000 | 500 | 100 GB | 1 TB/mo |
| 100,000 | 5,000 | 1 TB | 10 TB/mo |

---

## Maintenance Windows

### Recommended Schedule
- **Database maintenance**: Sundays 2:00-4:00 AM CET
- **Edge function updates**: Continuous (zero-downtime)
- **Frontend updates**: Anytime (cached)

### Communication
- Announce maintenance 48h in advance
- Status page during maintenance
- Post-maintenance summary email

---

## Compliance & Legal

### GDPR
- [ ] Cookie banner configured
- [ ] Privacy policy updated
- [ ] Data retention policies active
- [ ] User data export working
- [ ] Right to deletion working

### Financial Regulations
- [ ] Invoice numbering compliant
- [ ] VAT calculations correct
- [ ] Accounting exports working
- [ ] Transaction records archived (7 years)

---

## Support & Documentation

### User Support
- Email: contact@rivvlock.com
- Response time: <24h
- Escalation path defined

### Developer Documentation
- [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)
- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
- [API docs] (if applicable)

---

## Emergency Contacts

### Technical Issues
- **Platform**: Lovable Support (if hosted on Lovable)
- **Database**: Supabase Support
- **Payments**: Stripe Support
- **CDN/DNS**: Provider support

### Business Issues
- **Founder**: Bruno Dias - +41 76 429 40 34
- **Email**: contact@rivvlock.com

---

**Last Updated**: October 13, 2025  
**Next Review**: Before each major release
