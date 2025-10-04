// Security cleanup utilities
// This ensures no hardcoded sensitive data is exposed in logs or debug output

export const maskSensitiveData = (obj: any): any => {
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
      masked[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      masked[key] = maskSensitiveData(value);
    }
  }
  
  return masked;
};

export const sanitizeForLogs = (data: any): any => {
  return maskSensitiveData(data);
};