/**
 * Sentry configuration for error tracking and performance monitoring
 * 
 * Setup instructions:
 * 1. Create a Sentry account at https://sentry.io
 * 2. Create a new React project
 * 3. Copy the DSN from project settings
 * 4. Set VITE_SENTRY_DSN in your .env file
 * 
 * @see https://docs.sentry.io/platforms/javascript/guides/react/
 */


import * as Sentry from '@sentry/react';

/**
 * Initialize Sentry error tracking
 * Only runs in production to avoid noise during development
 */
export const initSentry = () => {
  // DSN resolution with safe debug fallbacks (ignored in PROD)
  const urlDsn = !import.meta.env.PROD ? new URLSearchParams(window.location.search).get('sentryDsn') : null;
  const debugDsn = !import.meta.env.PROD ? (localStorage.getItem('VITE_SENTRY_DSN_DEBUG') || (typeof window !== 'undefined' ? (window as any).__SENTRY_DSN__ : null)) : null;
  const SENTRY_DSN = (import.meta.env.VITE_SENTRY_DSN || urlDsn || debugDsn) as string | undefined;
  
  console.log('[Sentry Debug] DSN récupéré:', SENTRY_DSN);
  console.log('[Sentry Debug] Variables env:', {
    MODE: import.meta.env.MODE,
    PROD: import.meta.env.PROD,
    DEV: import.meta.env.DEV
  });

  // FORCE l'initialisation pour debug
  if (!SENTRY_DSN) {
    console.error('[Sentry] AUCUN DSN trouvé !');
    try { (window as any).__SENTRY_INITIALIZED__ = false; } catch {}
    return;
  }

  try {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: import.meta.env.MODE,
      
      // Performance monitoring
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({
          maskAllText: true,
          blockAllMedia: true,
        }),
      ],
      
      // Performance Monitoring
      tracesSampleRate: 0.1, // 10% of transactions for performance monitoring
      
      // Session Replay
      replaysSessionSampleRate: 0.1, // 10% of sessions
      replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors
      
      // Exclude sensitive data
      beforeSend(event) {
        // Remove PII from error reports
        if (event.request) {
          delete event.request.cookies;
          delete event.request.headers;
        }
        return event;
      },
      
      // Ignore common non-critical errors
      ignoreErrors: [
        // Browser extension errors
        'ResizeObserver loop limit exceeded',
        'Non-Error promise rejection captured',
        // Network errors
        'NetworkError',
        'Failed to fetch',
        // Stripe-related (handled by Stripe)
        'stripe',
      ],
    });

    console.log('[Sentry] Initialized successfully');
    try { (window as any).__SENTRY_INITIALIZED__ = true; (window as any).__SENTRY_DSN__ = SENTRY_DSN; } catch {}
  } catch (error) {
    console.error('[Sentry] Initialization failed:', error);
    try { (window as any).__SENTRY_INITIALIZED__ = false; } catch {}
  }
};

/**
 * Manually capture an exception
 * Use this for errors you want to track explicitly
 * 
 * @example
 * try {
 *   riskyOperation();
 * } catch (error) {
 *   captureException(error, { tags: { context: 'payment' } });
 * }
 */
export const captureException = (
  error: Error,
  context?: Record<string, any>
) => {
  if (import.meta.env.PROD) {
    Sentry.captureException(error, context);
  } else {
    console.error('[Sentry] Would capture:', error, context);
  }
};

/**
 * Set user context for error tracking
 * Call this after user logs in
 * 
 * @example
 * setUser({ id: user.id, email: user.email });
 */
export const setUser = (user: { id: string; email?: string } | null) => {
  if (import.meta.env.PROD) {
    Sentry.setUser(user);
  }
};

/**
 * Add breadcrumb for debugging context
 * Helps understand what led to an error
 * 
 * @example
 * addBreadcrumb({
 *   category: 'payment',
 *   message: 'User clicked pay button',
 *   level: 'info',
 * });
 */
export const addBreadcrumb = (breadcrumb: Record<string, any>) => {
  if (import.meta.env.PROD) {
    Sentry.addBreadcrumb(breadcrumb);
  }
};

export const getSentryStatus = () => {
  const runtimeDsn = (typeof window !== 'undefined' ? (window as any).__SENTRY_DSN__ : undefined) as string | undefined;
  const previewDsn = !import.meta.env.PROD && typeof window !== 'undefined' ? (localStorage.getItem('VITE_SENTRY_DSN_DEBUG') || undefined) : undefined;
  const envDsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  const resolvedDsn = envDsn || previewDsn || runtimeDsn;
  return {
    initialized: typeof window !== 'undefined' ? Boolean((window as any).__SENTRY_INITIALIZED__) : false,
    dsnConfigured: Boolean(resolvedDsn),
    mode: import.meta.env.MODE,
  } as const;
};
