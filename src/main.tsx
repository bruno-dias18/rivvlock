import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { forceCorrectUrl } from "./lib/appUrl";
import { logger } from "./lib/logger";
import { initSentry } from "./lib/sentry";

// Initialize Sentry error tracking (production only)
initSentry();

// Ensure public domain for shared links (redirect from editor/preview domains)
if (import.meta.env.PROD) {
  forceCorrectUrl();
}

window.addEventListener('error', (e) => {
  logger.error('🚨 [Global] window.error:', e.message, e.error);
});

window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
  logger.error('🚨 [Global] unhandledrejection:', e.reason);
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

createRoot(document.getElementById("root")!).render(<App />);
