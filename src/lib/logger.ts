// Production-hardened logging system with Sentry integration
// SECURITY: Errors always logged + sent to Sentry, debug logs only in dev
import * as Sentry from '@sentry/react';

const isDevelopment = import.meta.env.MODE === 'development';
const isProduction = import.meta.env.MODE === 'production';

export const logger = {
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },
  
  warn: (...args: any[]) => {
    // Warnings always visible (important for debugging)
    console.warn(...args);
    
    if (isProduction) {
      // Send to Sentry as breadcrumb
      Sentry.addBreadcrumb({
        category: 'warning',
        message: typeof args[0] === 'string' ? args[0] : JSON.stringify(args[0]),
        level: 'warning',
        data: args[1] || {},
      });
    }
  },
  
  error: (...args: any[]) => {
    // Errors ALWAYS logged to console (critical for debugging)
    console.error(...args);
    
    if (isProduction) {
      // Send to Sentry with full context
      const errorMessage = typeof args[0] === 'string' ? args[0] : String(args[0]);
      const context = args[1] || {};
      
      Sentry.captureException(
        args[0] instanceof Error ? args[0] : new Error(errorMessage),
        { extra: context }
      );
    }
  },
  
  info: (...args: any[]) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },
  
  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.debug(...args);
    }
  }
};
