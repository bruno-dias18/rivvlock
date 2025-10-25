# 📊 Monitoring & Observability

## Overview
RivvLock uses **Sentry** for production error tracking and performance monitoring.

## Sentry Configuration

### ✅ Active Configuration
**Project**: RivvLock Production  
**Region**: 🇪🇺 Germany (GDPR compliant)  
**Dashboard**: https://rivvlcok.sentry.io/projects/rivvlock-production  

Your Sentry DSN is already configured in `.env`:
```bash
VITE_SENTRY_DSN="https://840f4dc88bccc56a3c1a8ef02d7ec2f1@o4510193827184640.ingest.de.sentry.io/4510193842585680"
```

### Quick Links
- 📊 [Performance Dashboard](https://rivvlcok.sentry.io/performance/)
- 🐛 [Issues Dashboard](https://rivvlcok.sentry.io/issues/)
- 🎬 [Session Replays](https://rivvlcok.sentry.io/replays/)
- ⚙️ [Project Settings](https://rivvlcok.sentry.io/settings/projects/rivvlock-production/)
- 🔔 [Alerts Configuration](https://rivvlcok.sentry.io/alerts/rules/)

### Features Enabled
- **Error Tracking**: Automatic capture of unhandled errors
- **Performance Monitoring**: 10% of transactions sampled
- **Session Replay**: 10% of normal sessions, 100% of error sessions
- **User Context**: Automatic user identification on login
- **Breadcrumbs**: Track user actions leading to errors

### Configuration (`src/lib/sentry.ts`)
```typescript
Sentry.init({
  dsn: SENTRY_DSN,
  environment: 'production',
  tracesSampleRate: 0.1,        // 10% performance monitoring
  replaysSessionSampleRate: 0.1, // 10% session replay
  replaysOnErrorSampleRate: 1.0, // 100% replay on errors
});
```

## Error Boundaries

### Global Error Boundary
- **Location**: `src/components/GlobalErrorBoundary.tsx`
- **Scope**: Catches all application errors
- **Actions**: Shows user-friendly error page, allows reload/homepage navigation

### Local Error Boundaries
- **Location**: `src/components/LocalErrorBoundary.tsx`
- **Scope**: Wraps individual components/sections
- **Actions**: Shows inline error message, allows retry without full page reload

### Usage Example
```tsx
import { LocalErrorBoundary } from '@/components/LocalErrorBoundary';

<LocalErrorBoundary fallback={<CustomError />}>
  <CriticalComponent />
</LocalErrorBoundary>
```

## Automatic Error Tracking

### Authentication Events
- User login → Sentry user context set
- User logout → Sentry user context cleared
- Auth failures → Automatically logged

### Critical Actions Monitored
All edge function calls are automatically monitored:
- Payment processing
- Transaction creation
- Dispute management
- Admin operations

### User Context
When users are authenticated, Sentry automatically tracks:
- User ID
- User email
- Session information

## Production Logging

### Client-Side (`src/lib/logger.ts`)
```typescript
// Development: Full console output
// Production: Silent (no console spam)

logger.error('Critical error', error);  // Only in development
logger.info('User action');             // Only in development
```

### Server-Side (`supabase/functions/_shared/logger.ts`)
```typescript
// Development: Full console output
// Production: Silent (prevents info leakage)

logger.error('Edge function error', error); // Only in development
```

### Why Silent in Production?
- **Security**: Prevents sensitive data exposure in browser console
- **Performance**: Reduces browser overhead
- **Professionalism**: Clean user experience
- **Sentry**: All errors still captured by Sentry

## Manual Error Capture

### Capturing Exceptions
```typescript
import { captureException } from '@/lib/sentry';

try {
  await riskyOperation();
} catch (error) {
  captureException(error, {
    tags: { context: 'payment' },
    extra: { transactionId: '123' }
  });
}
```

### Adding Breadcrumbs
```typescript
import { addBreadcrumb } from '@/lib/sentry';

addBreadcrumb({
  category: 'payment',
  message: 'User clicked pay button',
  level: 'info',
  data: { amount: 1000, currency: 'EUR' }
});
```

## Ignored Errors

The following non-critical errors are automatically ignored:
- `ResizeObserver loop limit exceeded` (browser rendering)
- `Non-Error promise rejection captured` (handled rejections)
- `NetworkError`, `Failed to fetch` (network issues)
- Stripe SDK errors (handled by Stripe)

## Monitoring Checklist

### Before Production
- [ ] Sentry DSN configured in `.env`
- [ ] Sentry project created
- [ ] Error boundaries tested
- [ ] User context tracking verified
- [ ] Session replay tested

### Post-Deployment
- [ ] Check Sentry dashboard for errors
- [ ] Review performance metrics
- [ ] Monitor session replays
- [ ] Set up Sentry alerts (optional)

## Performance Monitoring

### Metrics Tracked
- **Page Load Time**: Initial load performance
- **API Response Time**: Edge function latency
- **Transaction Duration**: End-to-end operation time
- **User Interactions**: Click, navigation timing

### Sample Rates
- **Traces**: 10% (reduce costs while getting insights)
- **Errors**: 100% (catch all errors)
- **Replays**: 10% normal, 100% on errors

## Security & Privacy

### PII Protection
```typescript
beforeSend(event) {
  // Remove sensitive headers and cookies
  if (event.request) {
    delete event.request.cookies;
    delete event.request.headers;
  }
  return event;
}
```

### Session Replay Privacy
- `maskAllText: true` - Masks all text content
- `blockAllMedia: true` - Blocks images/videos
- Only captures DOM structure and interactions

## Troubleshooting

### Sentry Not Capturing Errors
1. Check `VITE_SENTRY_DSN` is set
2. Verify `import.meta.env.MODE === 'production'`
3. Check browser console for Sentry init message
4. Test with `throw new Error('test')` in production

### User Context Not Set
1. Verify user is authenticated
2. Check `AuthContext` Sentry integration
3. Look for "Auth state changed" logs in development

### Performance Issues
1. Reduce `tracesSampleRate` (currently 10%)
2. Reduce `replaysSessionSampleRate` (currently 10%)
3. Disable session replay if not needed

## Cost Optimization

### Free Tier Limits
- 5,000 errors/month
- 10,000 performance units/month
- 50 session replays/month

### Staying Within Limits
- **10% sampling** keeps within free tier for ~50k users/month
- Adjust sample rates based on traffic
- Use Sentry quotas to set hard limits

## Next Steps After Deployment

### 1. Verify Sentry Integration (2 min)
After your next deployment:
1. Visit your production app
2. Trigger a test error: navigate to `/test-404`
3. Check [Sentry Issues](https://rivvlcok.sentry.io/issues/) (~30 seconds delay)
4. You should see the 404 error appear

### 2. Configure Alerts (5 min)
Recommended alerts to set up in [Alerts Dashboard](https://rivvlcok.sentry.io/alerts/rules/):

**Critical Alert - High Error Rate:**
- When: Error rate > 1%
- Action: Email immediately
- Why: Indicates a critical production issue

**Performance Alert - Slow Response:**
- When: P95 response time > 2 seconds
- Action: Email daily digest
- Why: User experience degradation

**New Issue Alert:**
- When: New error type appears
- Action: Email within 1 hour
- Why: Catch regressions quickly

### 3. Monitor Key Metrics
Check these dashboards weekly:
- **Performance**: Track P50/P95 response times
- **Errors**: Review error frequency and patterns
- **Replays**: Watch user sessions that encountered errors

## Links

- 🏠 [Your Sentry Dashboard](https://rivvlcok.sentry.io/)
- 📊 [RivvLock Project](https://rivvlcok.sentry.io/projects/rivvlock-production/)
- 📚 [Sentry React Docs](https://docs.sentry.io/platforms/javascript/guides/react/)
- 🎬 [Session Replay Guide](https://docs.sentry.io/product/session-replay/)
- ⚡ [Performance Monitoring](https://docs.sentry.io/product/performance/)
