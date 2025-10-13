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
  const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
  const IS_PRODUCTION = import.meta.env.MODE === 'production';

  // Only initialize in production and if DSN is provided
  if (!IS_PRODUCTION || !SENTRY_DSN) {
    console.log('[Sentry] Skipped initialization (development mode or missing DSN)');
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
  } catch (error) {
    console.error('[Sentry] Initialization failed:', error);
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
  if (import.meta.env.MODE === 'production') {
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
  if (import.meta.env.MODE === 'production') {
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
  if (import.meta.env.MODE === 'production') {
    Sentry.addBreadcrumb(breadcrumb);
  }
};
