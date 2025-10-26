import { z } from 'zod';

/**
 * IBAN Validation Utilities
 * Implements robust IBAN validation including format, checksum, and credit card detection
 */

// IBAN length by country code
const IBAN_LENGTHS: Record<string, number> = {
  CH: 21, // Switzerland
  FR: 27, // France
  DE: 22, // Germany
  IT: 27, // Italy
  ES: 24, // Spain
  AT: 20, // Austria
  BE: 16, // Belgium
  NL: 18, // Netherlands
  LU: 20, // Luxembourg
  GB: 22, // United Kingdom
  US: 0,  // US doesn't use IBAN
};

/**
 * Detects if a string looks like a credit card number
 */
export function isCreditCardNumber(value: string): boolean {
  const cleaned = value.replace(/[\s-]/g, '');
  
  // Check if it's all digits (credit cards are all numeric)
  if (!/^\d+$/.test(cleaned)) {
    return false;
  }
  
  // Common test credit card prefixes
  const creditCardPrefixes = [
    '4111', '4222', '4444', '4012', // Visa test cards
    '5555', '5105', '5200', '5454', // Mastercard test cards
    '3782', '3714', '3787', // Amex test cards
    '6011', '6500', // Discover test cards
  ];
  
  return creditCardPrefixes.some(prefix => cleaned.startsWith(prefix));
}

/**
 * Validates IBAN format (2 letters + 2 digits + alphanumeric)
 */
export function isValidIBANFormat(iban: string): boolean {
  const cleaned = iban.replace(/[\s-]/g, '').toUpperCase();
  
  // Must start with 2 letters (country code) followed by 2 digits (check digits)
  const formatRegex = /^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/;
  
  if (!formatRegex.test(cleaned)) {
    return false;
  }
  
  // Check length is valid for the country
  const countryCode = cleaned.substring(0, 2);
  const expectedLength = IBAN_LENGTHS[countryCode];
  
  if (expectedLength && cleaned.length !== expectedLength) {
    return false;
  }
  
  // General length check (IBAN is between 15 and 34 characters)
  return cleaned.length >= 15 && cleaned.length <= 34;
}

/**
 * Validates IBAN checksum using mod-97 algorithm
 */
export function isValidIBANChecksum(iban: string): boolean {
  const cleaned = iban.replace(/[\s-]/g, '').toUpperCase();
  
  if (!isValidIBANFormat(cleaned)) {
    return false;
  }
  
  // Move first 4 characters to the end
  const rearranged = cleaned.substring(4) + cleaned.substring(0, 4);
  
  // Replace letters with numbers (A=10, B=11, ..., Z=35)
  const numericString = rearranged.replace(/[A-Z]/g, (char) => {
    return (char.charCodeAt(0) - 55).toString();
  });
  
  // Calculate mod 97
  let remainder = numericString;
  while (remainder.length > 2) {
    const block = remainder.substring(0, 9);
    remainder = (parseInt(block, 10) % 97).toString() + remainder.substring(block.length);
  }
  
  return parseInt(remainder, 10) % 97 === 1;
}

/**
 * Formats IBAN with spaces every 4 characters for readability
 */
export function formatIBAN(iban: string): string {
  const cleaned = iban.replace(/[\s-]/g, '').toUpperCase();
  return cleaned.match(/.{1,4}/g)?.join(' ') || cleaned;
}

/**
 * Gets the expected IBAN length for a country code
 */
export function getExpectedIBANLength(countryCode: string): number | null {
  return IBAN_LENGTHS[countryCode.toUpperCase()] || null;
}

/**
 * Gets a validation message for the IBAN
 */
export function getIBANValidationMessage(iban: string): string | null {
  const cleaned = iban.replace(/[\s-]/g, '').toUpperCase();
  
  if (!cleaned) {
    return 'IBAN requis';
  }
  
  if (isCreditCardNumber(cleaned)) {
    return '❌ Ceci est un numéro de carte bancaire, pas un IBAN';
  }
  
  if (!/^[A-Z]{2}/.test(cleaned)) {
    return 'L\'IBAN doit commencer par 2 lettres (code pays)';
  }
  
  if (!/^[A-Z]{2}[0-9]{2}/.test(cleaned)) {
    return 'L\'IBAN doit avoir 2 chiffres après le code pays';
  }
  
  const countryCode = cleaned.substring(0, 2);
  const expectedLength = IBAN_LENGTHS[countryCode];
  
  if (expectedLength && cleaned.length !== expectedLength) {
    return `L'IBAN ${countryCode} doit contenir ${expectedLength} caractères (actuellement: ${cleaned.length})`;
  }
  
  if (cleaned.length < 15) {
    return 'IBAN trop court (minimum 15 caractères)';
  }
  
  if (cleaned.length > 34) {
    return 'IBAN trop long (maximum 34 caractères)';
  }
  
  if (!isValidIBANFormat(cleaned)) {
    return 'Format IBAN invalide';
  }
  
  if (!isValidIBANChecksum(cleaned)) {
    return 'IBAN invalide (numéro de contrôle incorrect)';
  }
  
  return null; // Valid!
}

/**
 * Zod schema for Adyen payout account validation
 */
export const adyenBankAccountSchema = z.object({
  iban: z.string()
    .trim()
    .min(1, 'IBAN requis')
    .transform(val => val.replace(/[\s-]/g, '').toUpperCase())
    .refine((val) => !isCreditCardNumber(val), {
      message: '❌ Ceci est un numéro de carte bancaire, pas un IBAN',
    })
    .refine((val) => isValidIBANFormat(val), {
      message: 'Format IBAN invalide',
    })
    .refine((val) => isValidIBANChecksum(val), {
      message: 'IBAN invalide (numéro de contrôle incorrect)',
    }),
  bic: z.string().trim().optional().or(z.literal('')),
  account_holder_name: z.string()
    .trim()
    .min(2, 'Le nom du titulaire doit contenir au moins 2 caractères')
    .max(100, 'Le nom du titulaire ne peut pas dépasser 100 caractères'),
  bank_name: z.string().trim().optional().or(z.literal('')),
  country: z.string().length(2, 'Code pays invalide'),
});

export type AdyenBankAccountFormData = z.infer<typeof adyenBankAccountSchema>;
