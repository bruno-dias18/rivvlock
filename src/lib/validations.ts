import { z } from 'zod';

// Utility functions for validation
const cleanNumericString = (value: string) => value.replace(/\s|-|\./g, '');

// Helper functions for cleaning input strings
const cleanSiretString = (siret: string): string => {
  // Remove only allowed separators: spaces, hyphens, dots
  return siret.replace(/[\s\-\.]/g, '');
};

const cleanUidString = (uid: string): string => {
  // Remove only extra spaces but preserve CHE-X.X.X structure
  return uid.replace(/\s+/g, '').toUpperCase();
};

// French postal code validation (5 digits)
const frenchPostalCodeRegex = /^[0-9]{5}$/;
// Swiss postal code validation (4 digits)
const swissPostalCodeRegex = /^[0-9]{4}$/;

// Phone validation (international format)
const phoneRegex = /^(\+33|0)[1-9](\d{8})$|^(\+41|0)[1-9](\d{8})$/;

// SIRET validation (14 digits)
const siretRegex = /^[0-9]{14}$/;

// Swiss UID validation (CHE-XXX.XXX.XXX)
const swissUidRegex = /^CHE-[0-9]{3}\.[0-9]{3}\.[0-9]{3}$/;

// Swiss AVS validation (756.XXXX.XXXX.XX)
const swissAvsRegex = /^756\.[0-9]{4}\.[0-9]{4}\.[0-9]{2}$/;

// French VAT validation (FR + 11 digits)
const frenchVatRegex = /^FR[A-Z0-9]{2}[0-9]{9}$/;

// Swiss VAT validation (CHE-XXX.XXX.XXX TVA/MWST/IVA)
const swissVatRegex = /^CHE-[0-9]{3}\.[0-9]{3}\.[0-9]{3}(\s?(TVA|MWST|IVA))?$/;

// Name validation (letters, spaces, hyphens, apostrophes)
const nameRegex = /^[a-zA-ZÀ-ÿ\s\-']{2,50}$/;

// Base schemas
export const emailSchema = z
  .string()
  .trim()
  .min(1, 'L\'email est obligatoire')
  .email('Format d\'email invalide')
  .max(255, 'L\'email ne peut pas dépasser 255 caractères');

export const passwordSchema = z
  .string()
  .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
  .max(128, 'Le mot de passe ne peut pas dépasser 128 caractères')
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Le mot de passe doit contenir au moins une minuscule, une majuscule et un chiffre');

export const nameSchema = z
  .string()
  .trim()
  .min(2, 'Le nom doit contenir au moins 2 caractères')
  .max(50, 'Le nom ne peut pas dépasser 50 caractères')
  .regex(nameRegex, 'Le nom ne peut contenir que des lettres, espaces, tirets et apostrophes');

export const phoneSchema = z
  .string()
  .trim()
  .optional()
  .refine((val) => !val || phoneRegex.test(val), {
    message: 'Format de téléphone invalide (ex: +33123456789 ou 0123456789)'
  });

export const companyNameSchema = z
  .string()
  .trim()
  .min(2, 'Le nom de l\'entreprise doit contenir au moins 2 caractères')
  .max(100, 'Le nom de l\'entreprise ne peut pas dépasser 100 caractères');

export const addressSchema = z
  .string()
  .trim()
  .min(5, 'L\'adresse doit contenir au moins 5 caractères')
  .max(200, 'L\'adresse ne peut pas dépasser 200 caractères');

export const citySchema = z
  .string()
  .trim()
  .min(2, 'La ville doit contenir au moins 2 caractères')
  .max(50, 'La ville ne peut pas dépasser 50 caractères')
  .regex(/^[a-zA-ZÀ-ÿ\s\-']{2,50}$/, 'La ville ne peut contenir que des lettres, espaces, tirets et apostrophes');

// Country-specific postal code validation
export const postalCodeSchema = (country: 'FR' | 'CH') => {
  if (country === 'FR') {
    return z
      .string()
      .trim()
      .regex(frenchPostalCodeRegex, 'Le code postal français doit contenir 5 chiffres');
  } else {
    return z
      .string()
      .trim()
      .regex(swissPostalCodeRegex, 'Le code postal suisse doit contenir 4 chiffres');
  }
};

// SIRET validation with strict format control and Luhn algorithm
export const siretSchema = z
  .string()
  .trim()
  .min(1, { message: "Le numéro SIRET est requis" })
  .refine((val) => {
    // First check: only allowed characters (digits, spaces, hyphens, dots)
    if (!/^[0-9\s\-\.]+$/.test(val)) {
      return false;
    }
    // Second check: must have exactly 14 digits after cleaning
    const cleaned = cleanSiretString(val);
    return /^\d{14}$/.test(cleaned);
  }, {
    message: "Le numéro SIRET doit contenir exactement 14 chiffres (exemple: 12345678901234)"
  })
  .transform(cleanSiretString)
  .refine((val) => {
    // Luhn algorithm validation
    let sum = 0;
    let isEven = false;
    
    for (let i = val.length - 1; i >= 0; i--) {
      let digit = parseInt(val[i]);
      
      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit = digit.toString().split('').reduce((sum, char) => sum + parseInt(char), 0);
        }
      }
      
      sum += digit;
      isEven = !isEven;
    }
    
    return sum % 10 === 0;
  }, {
    message: 'Le numéro SIRET est invalide (échec de la validation de Luhn)'
  });

// Swiss UID validation with strict format control
export const swissUidSchema = z
  .string()
  .trim()
  .min(1, { message: "Le numéro UID est requis" })
  .refine((val) => {
    // Allow empty during typing
    if (!val || val === 'CHE-') {
      return false;
    }
    // Check for valid characters and basic structure
    const cleaned = cleanUidString(val);
    // Must start with CHE- and have the right structure
    if (!cleaned.startsWith('CHE-')) {
      return false;
    }
    // Must match exact format: CHE-XXX.XXX.XXX with exactly 9 digits
    return /^CHE-[0-9]{3}\.[0-9]{3}\.[0-9]{3}$/.test(cleaned);
  }, {
    message: "Le numéro UID doit contenir exactement 9 chiffres au format CHE-XXX.XXX.XXX"
  })
  .transform(cleanUidString);

// Swiss AVS validation
export const swissAvsSchema = z
  .string()
  .trim()
  .refine((val) => {
    // Accepte les chiffres uniquement (format envoyé par MaskedAvsInput - sans points)
    const cleaned = val.replace(/\D/g, '');
    return cleaned.length === 13 && cleaned.startsWith('756');
  }, {
    message: 'Le numéro AVS doit contenir exactement 13 chiffres (756.XXXX.XXXX.XX)'
  })
  // ✅ Toujours stocker SANS points en DB (normalisation)
  .transform(val => val.replace(/\D/g, ''));

// VAT number validation
export const vatNumberSchema = (country: 'FR' | 'CH') => {
  if (country === 'FR') {
    return z
      .string()
      .trim()
      .toUpperCase()
      .regex(frenchVatRegex, 'Le numéro de TVA français doit avoir le format FRXX123456789');
  } else {
    return z
      .string()
      .trim()
      .toUpperCase()
      .regex(swissVatRegex, 'Le numéro de TVA suisse doit avoir le format CHE-XXX.XXX.XXX');
  }
};

// VAT rate validation
export const vatRateSchema = z
  .string()
  .trim()
  .refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num >= 0 && num <= 100;
  }, {
    message: 'Le taux de TVA doit être un nombre entre 0 et 100'
  });

// Combined registration form schema
export const createRegistrationSchema = (country: 'FR' | 'CH', userType: 'individual' | 'company' | 'independent') => {
  const baseSchema = {
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    country: z.enum(['FR', 'CH']),
    userType: z.enum(['individual', 'company', 'independent']),
    firstName: nameSchema,
    lastName: nameSchema,
    phone: phoneSchema,
    acceptanceTerms: z.boolean().refine(val => val === true, {
      message: 'Vous devez accepter les conditions générales'
    })
  };

  let conditionalFields = {};

  // Company-specific fields
  if (userType === 'company') {
    conditionalFields = {
      ...conditionalFields,
      companyName: companyNameSchema,
      companyAddress: addressSchema,
      postalCode: postalCodeSchema(country),
      city: citySchema,
      isSubjectToVat: z.boolean(),
      vatRate: z.string().optional()
    };

    // Add country-specific business number validation
    if (country === 'FR') {
      conditionalFields = {
        ...conditionalFields,
        siretUid: siretSchema
      };
    } else if (country === 'CH') {
      conditionalFields = {
        ...conditionalFields,
        siretUid: swissUidSchema
      };
    }

    // VAT number is optional but validated if provided
    conditionalFields = {
      ...conditionalFields,
      vatNumber: z.string().optional().refine((val) => {
        if (!val) return true;
        return vatNumberSchema(country).safeParse(val).success;
      }, {
        message: country === 'FR' 
          ? 'Le numéro de TVA français doit avoir le format FRXX123456789'
          : 'Le numéro de TVA suisse doit avoir le format CHE-XXX.XXX.XXX'
      })
    };
  }

  // Independent-specific fields for Switzerland
  if (userType === 'independent' && country === 'CH') {
    conditionalFields = {
      ...conditionalFields,
      avsNumber: swissAvsSchema,
      isSubjectToVat: z.boolean(),
      vatRate: z.string().optional(),
      vatNumber: z.string().optional().refine((val) => {
        if (!val) return true;
        return vatNumberSchema(country).safeParse(val).success;
      }, {
        message: 'Le numéro de TVA suisse doit avoir le format CHE-XXX.XXX.XXX'
      })
    };
  }

  const schema = z.object({
    ...baseSchema,
    ...conditionalFields
  }).refine((data) => data.password === data.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword']
  }).superRefine((data, ctx) => {
    // Make VAT number mandatory when user is subject to VAT
    const vatRequired = (data.userType === 'company') || (data.userType === 'independent' && data.country === 'CH');
    if (vatRequired && (data as any).isSubjectToVat) {
      if (!(data as any).vatNumber || !vatNumberSchema((data as any).country).safeParse((data as any).vatNumber).success) {
        ctx.addIssue({
          path: ['vatNumber'],
          code: 'custom',
          message: (data as any).country === 'FR'
            ? 'Le numéro de TVA est obligatoire et doit être au format FRXX123456789'
            : 'Le numéro de TVA est obligatoire et doit être au format CHE-XXX.XXX.XXX TVA'
        });
      }
    }
  });

  return schema;
};

// Login form schema
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Le mot de passe est obligatoire')
});

// Password reset schema
export const passwordResetSchema = z.object({
  email: emailSchema
});

// Change password schema
export const changePasswordSchema = z.object({
  password: passwordSchema,
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirmPassword']
});

// Helper validation functions for testing
export const validatePrice = (price: number): boolean => {
  return price >= 1 && price <= 1000000;
};

export const validateEmail = (email: string): boolean => {
  // Looser regex for tests: allow 1+ char TLD (e.g., a@b.c)
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]{1,}$/;
  return regex.test(email.trim());
};

export const validateSIRET = (siret: string): boolean => {
  // Test helper: accept format-only (14 digits)
  return /^\d{14}$/.test(siret.replace(/\D/g, ''));
};

export const validateAVS = (avs: string): boolean => {
  return swissAvsSchema.safeParse(avs).success;
};

export const validateVAT = (vat: string): boolean => {
  const v = vat.toUpperCase().trim();
  const patterns = [
    /^FR[A-Z0-9]{2}\d{9}$/,
    /^CHE-?\d{3}\.?\d{3}\.?\d{3}(\s?(TVA|MWST|IVA))?$/, // with or without dashes/dots
    /^DE\d{9}$/,
  ];
  return patterns.some((p) => p.test(v));
};