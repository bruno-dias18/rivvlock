import { isMobileDevice } from './mobileUtils';

// Centralized base URL for shareable links
// IMPORTANT: Always use the preview domain that works correctly
// DO NOT CHANGE THIS - the lovableproject.com domain doesn't work
const WORKING_DOMAIN = 'https://id-preview--cfd5feba-e675-4ca7-b281-9639755fdc6f.lovable.app';
const OBSOLETE_DOMAINS = [
  'https://rivv-secure-escrow.lovable.app',
  'https://lovableproject.com'
];

// Version du système d'URL pour forcer le refresh en cas de changement
const URL_VERSION = 'v2.2';

export function getAppBaseUrl(): string {
  const currentUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const isMobile = typeof window !== 'undefined' ? isMobileDevice() : false;
  
  // Détecter si on utilise une URL obsolète
  if (OBSOLETE_DOMAINS.includes(currentUrl)) {
    console.warn('⚠️ [APP-URL] OBSOLETE URL DETECTED:', currentUrl);
    console.warn('⚠️ [APP-URL] Should be using:', WORKING_DOMAIN);
    
    // Forcer la redirection immédiatement (mobile ET desktop)
    if (typeof window !== 'undefined') {
      console.log('🔄 [APP-URL] Redirecting user to correct domain... (mobile:', isMobile, ')');
      const targetUrl = WORKING_DOMAIN + window.location.pathname + window.location.search + window.location.hash;
      window.location.replace(targetUrl);
      return WORKING_DOMAIN; // Retourner quand même pour éviter les erreurs
    }
  }
  
  // Logs détaillés pour le débogage
  console.log('🌐 [APP-URL] URL Generation Debug:', {
    workingDomain: WORKING_DOMAIN,
    currentOrigin: currentUrl,
    isMobile,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A',
    version: URL_VERSION,
    timestamp: new Date().toISOString()
  });
  
  // Toujours retourner le domaine de travail correct
  console.log('🌐 [APP-URL] Using working domain:', WORKING_DOMAIN);
  return WORKING_DOMAIN;
}

// Fonction pour vérifier si l'URL actuelle est obsolète
export function isObsoleteUrl(): boolean {
  if (typeof window === 'undefined') return false;
  return OBSOLETE_DOMAINS.includes(window.location.origin);
}

// Fonction pour forcer la redirection vers la bonne URL
export function forceCorrectUrl(): void {
  if (typeof window === 'undefined') return;
  
  if (isObsoleteUrl()) {
    console.log('🔄 [APP-URL] Forcing redirect to correct URL...');
    const newUrl = WORKING_DOMAIN + window.location.pathname + window.location.search;
    window.location.replace(newUrl);
  }
}
