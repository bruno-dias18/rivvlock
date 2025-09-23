import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Startup diagnostics
console.log('[BOOT] App starting...');

window.addEventListener('error', (e) => {
  console.error('🚨 [Global] window.error:', e.message, e.error);
});

window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
  console.error('🚨 [Global] unhandledrejection:', e.reason);
});

// Service Worker management
if (import.meta.env.PROD) {
  // Register SW only in production
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('SW registered: ', registration);
        })
        .catch((registrationError) => {
          console.log('SW registration failed: ', registrationError);
        });
    });
  }
} else {
  // In development, clear all existing service workers and caches
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => {
        registration.unregister();
        console.log('Unregistered SW:', registration);
      });
    });
  }
  
  if ('caches' in window) {
    caches.keys().then((names) => {
      names.forEach((name) => {
        caches.delete(name);
        console.log('Deleted cache:', name);
      });
    });
  }
}

createRoot(document.getElementById("root")!).render(<App />);
