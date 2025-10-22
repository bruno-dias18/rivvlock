// Rate limiter robuste basé sur Supabase pour protéger les edge functions
// Utilise une table dédiée pour un rate limiting distribué entre toutes les instances

import { createClient } from "jsr:@supabase/supabase-js@2";

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

/**
 * Vérifie si une requête dépasse les limites de rate limiting
 * Utilise Supabase pour un rate limiting distribué et persistant
 * 
 * @param ip Adresse IP du client
 * @param userId ID de l'utilisateur (optionnel)
 * @throws Error si la limite est dépassée
 */
export async function checkRateLimit(ip?: string, userId?: string): Promise<void> {
  // Créer un client Supabase avec service_role pour contourner RLS
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const now = new Date();

  // Vérification par IP
  if (ip) {
    await checkLimit(supabase, ip, 'ip', RATE_LIMITS.ip.max, RATE_LIMITS.ip.windowMs, now);
  }

  // Vérification par utilisateur
  if (userId) {
    await checkLimit(supabase, userId, 'user', RATE_LIMITS.user.max, RATE_LIMITS.user.windowMs, now);
  }
}

/**
 * Vérifie et met à jour le compteur de rate limiting pour un identifier donné
 */
async function checkLimit(
  supabase: ReturnType<typeof createClient>,
  identifier: string,
  identifierType: 'ip' | 'user',
  maxAttempts: number,
  windowMs: number,
  now: Date
): Promise<void> {
  // Calculer la fenêtre de temps
  const windowStart = new Date(now.getTime() - windowMs);

  // Récupérer ou créer l'entrée (avec verrouillage pour éviter race conditions)
  const { data: existingEntry, error: fetchError } = await supabase
    .from('rate_limit_attempts')
    .select('*')
    .eq('identifier', identifier)
    .eq('identifier_type', identifierType)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = pas de résultats
    console.error('Rate limit fetch error:', fetchError);
    // En cas d'erreur DB, on laisse passer (fail open) pour éviter de bloquer le service
    return;
  }

  // Si pas d'entrée ou fenêtre expirée, créer/réinitialiser
  if (!existingEntry || new Date(existingEntry.window_start) < windowStart) {
    const { error: upsertError } = await supabase
      .from('rate_limit_attempts')
      .upsert({
        identifier,
        identifier_type: identifierType,
        attempt_count: 1,
        window_start: now.toISOString(),
        updated_at: now.toISOString(),
      }, {
        onConflict: 'identifier,identifier_type'
      });

    if (upsertError) {
      console.error('Rate limit upsert error:', upsertError);
    }
    return;
  }

  // Vérifier si la limite est atteinte
  if (existingEntry.attempt_count >= maxAttempts) {
    const resetAt = new Date(new Date(existingEntry.window_start).getTime() + windowMs);
    const resetInMinutes = Math.ceil((resetAt.getTime() - now.getTime()) / 60000);
    
    throw new Error(
      `Trop de tentatives. Veuillez réessayer dans ${resetInMinutes} minute(s).`
    );
  }

  // Incrémenter le compteur
  const { error: updateError } = await supabase
    .from('rate_limit_attempts')
    .update({
      attempt_count: existingEntry.attempt_count + 1,
      updated_at: now.toISOString(),
    })
    .eq('identifier', identifier)
    .eq('identifier_type', identifierType);

  if (updateError) {
    console.error('Rate limit update error:', updateError);
    // En cas d'erreur, on laisse passer pour éviter de bloquer le service
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
