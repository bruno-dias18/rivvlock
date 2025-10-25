import { createRoot } from "react-dom/client";

import "./index.css";
import { forceCorrectUrl } from "./lib/appUrl";
import { logger } from "./lib/logger";
import { initSentry, captureException } from "./lib/sentry";
import { initWebVitals } from "./lib/monitoring";

// Initialize Sentry error tracking (production only)
initSentry();

// Initialize Core Web Vitals monitoring
initWebVitals();

// Ensure public domain for shared links (redirect from editor/preview domains)
if (import.meta.env.PROD) {
  forceCorrectUrl();
}

// Runtime cache recovery helper for production
const attemptCacheRecovery = (() => {
  let triggered = false;
  return (hint?: string) => {
    try {
      if (triggered || !import.meta.env.PROD) return;
      triggered = true;
      // Ask SW to purge caches
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'PURGE_CACHES', hint });
      }
      const purgeCaches = 'caches' in window
        ? caches.keys().then(names => Promise.all(names.map(n => caches.delete(n))))
        : Promise.resolve();
      const unregisterSW = 'serviceWorker' in navigator
        ? navigator.serviceWorker.getRegistrations().then(regs => Promise.all(regs.map(r => r.unregister())))
        : Promise.resolve();
      Promise.all([purgeCaches, unregisterSW]).finally(() => {
        const url = new URL(window.location.href);
        url.searchParams.set('v', String(Date.now()));
        window.location.replace(url.toString());
      });
    } catch {
      const url = new URL(window.location.href);
      url.searchParams.set('v', String(Date.now()));
      window.location.replace(url.toString());
    }
  };
})();
window.addEventListener('error', (e) => {
  logger.error('🚨 [Global] window.error:', e.message, e.error);
  if (e.error) captureException(e.error, { tags: { source: 'window.error' } });
  // Attempt recovery for fatal bootstrap errors in production
  const msg = (e?.message || '').toLowerCase();
  if (import.meta.env.PROD && (msg.includes('chunk') || msg.includes('createcontext') || msg.includes('failed to fetch') || msg.includes('loading'))) {
    attemptCacheRecovery('window.error:' + e.message);
  }
});

window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
  logger.error('🚨 [Global] unhandledrejection:', e.reason);
  const error = e.reason instanceof Error ? e.reason : new Error(String(e.reason));
  captureException(error, { tags: { source: 'unhandledrejection' } });
  const reason = String(e.reason || '').toLowerCase();
  if (import.meta.env.PROD && (reason.includes('chunk') || reason.includes('createcontext') || reason.includes('failed to fetch') || reason.includes('loading'))) {
    attemptCacheRecovery('unhandledrejection:' + reason);
  }
});

// Service Worker management
if (import.meta.env.PROD) {
  // Register SW only in production
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .catch((registrationError) => {
          logger.error('SW registration failed:', registrationError);
        });
    });
  }
} else {
  // In development, clear all existing service workers and caches
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => {
        registration.unregister();
      });
    });
  }
  
  if ('caches' in window) {
    caches.keys().then((names) => {
      names.forEach((name) => {
        caches.delete(name);
      });
    });
  }
}

const rootEl = document.getElementById("root")!;

import('./App.tsx')
  .then(({ default: App }) => {
    createRoot(rootEl).render(<App />);
  })
  .catch((err) => {
    logger.error('Failed to bootstrap app:', err);
    captureException(err, { tags: { source: 'bootstrap' } });
    attemptCacheRecovery('import-app-failed');
  });