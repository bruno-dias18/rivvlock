// Rate limiter pour protéger les edge functions contre les abus
// Utilise une Map en mémoire pour stocker les tentatives par IP et par utilisateur

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// Maps pour suivre les tentatives
const ipAttempts = new Map<string, RateLimitEntry>();
const userAttempts = new Map<string, RateLimitEntry>();

// Configuration des limites
const RATE_LIMITS = {
  ip: {
    max: 100,
    windowMs: 60 * 60 * 1000, // 1 heure
  },
  user: {
    max: 50,
    windowMs: 60 * 60 * 1000, // 1 heure
  },
};

// Nettoyage périodique des entrées expirées (pour éviter les fuites mémoire)
setInterval(() => {
  const now = Date.now();
  
  for (const [key, entry] of ipAttempts.entries()) {
    if (entry.resetAt < now) {
      ipAttempts.delete(key);
    }
  }
  
  for (const [key, entry] of userAttempts.entries()) {
    if (entry.resetAt < now) {
      userAttempts.delete(key);
    }
  }
}, 5 * 60 * 1000); // Nettoyage toutes les 5 minutes

/**
 * Vérifie si une requête dépasse les limites de rate limiting
 * @param ip Adresse IP du client
 * @param userId ID de l'utilisateur (optionnel)
 * @throws Error si la limite est dépassée
 */
export async function checkRateLimit(ip?: string, userId?: string): Promise<void> {
  const now = Date.now();

  // Vérification par IP
  if (ip) {
    const ipEntry = ipAttempts.get(ip);
    
    if (ipEntry) {
      if (ipEntry.resetAt < now) {
        // Fenêtre expirée, réinitialiser
        ipAttempts.set(ip, { count: 1, resetAt: now + RATE_LIMITS.ip.windowMs });
      } else if (ipEntry.count >= RATE_LIMITS.ip.max) {
        const resetInMinutes = Math.ceil((ipEntry.resetAt - now) / 60000);
        throw new Error(
          `Trop de tentatives. Veuillez réessayer dans ${resetInMinutes} minute(s).`
        );
      } else {
        ipEntry.count++;
      }
    } else {
      ipAttempts.set(ip, { count: 1, resetAt: now + RATE_LIMITS.ip.windowMs });
    }
  }

  // Vérification par utilisateur
  if (userId) {
    const userEntry = userAttempts.get(userId);
    
    if (userEntry) {
      if (userEntry.resetAt < now) {
        // Fenêtre expirée, réinitialiser
        userAttempts.set(userId, { count: 1, resetAt: now + RATE_LIMITS.user.windowMs });
      } else if (userEntry.count >= RATE_LIMITS.user.max) {
        const resetInMinutes = Math.ceil((userEntry.resetAt - now) / 60000);
        throw new Error(
          `Trop de tentatives. Veuillez réessayer dans ${resetInMinutes} minute(s).`
        );
      } else {
        userEntry.count++;
      }
    } else {
      userAttempts.set(userId, { count: 1, resetAt: now + RATE_LIMITS.user.windowMs });
    }
  }
}

/**
 * Extrait l'adresse IP de la requête
 */
export function getClientIp(req: Request): string | undefined {
  // Essayer plusieurs headers dans l'ordre de priorité
  const headers = [
    'x-forwarded-for',
    'x-real-ip',
    'cf-connecting-ip', // Cloudflare
    'x-client-ip',
  ];

  for (const header of headers) {
    const value = req.headers.get(header);
    if (value) {
      // x-forwarded-for peut contenir plusieurs IPs séparées par des virgules
      return value.split(',')[0].trim();
    }
  }

  return undefined;
}
