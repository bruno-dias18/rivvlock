// Security cleanup utilities
// This ensures no hardcoded sensitive data is exposed in logs or debug output

export const maskSensitiveData = (obj: unknown): unknown => {
  if (!obj || typeof obj !== 'object') return obj;
  
  const sensitiveFields = [
    'password', 'token', 'secret', 'key', 'apikey', 'stripe_customer_id',
    'stripe_account_id', 'payment_intent_id', 'phone', 'email', 'first_name',
    'last_name', 'address', 'postal_code', 'city', 'siret_uid', 'vat_number',
    'avs_number', 'company_address', 'Authorization'
  ];
  
  const masked = Array.isArray(obj) ? [...obj] : { ...obj };
  
  for (const [key, value] of Object.entries(masked)) {
    if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
      (masked as Record<string, unknown>)[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      (masked as Record<string, unknown>)[key] = maskSensitiveData(value);
    }
  }
  
  return masked;
};

export const sanitizeForLogs = (data: unknown): unknown => {
  return maskSensitiveData(data);
};

// Cleanup expired data helper
export const cleanupExpiredData = <T extends { expires_at?: string }>(
  items: T[]
): T[] => {
  const now = Date.now();
  return items.filter(item => {
    if (!item.expires_at) return false;
    const expiresAt = new Date(item.expires_at).getTime();
    return expiresAt < now;
  });
};

// Schedule cleanup helper
export const scheduleCleanup = (
  cleanupFn: () => void,
  intervalMs: number
): (() => void) => {
  const intervalId = setInterval(cleanupFn, intervalMs);
  return () => clearInterval(intervalId);
};