// Validation serveur avec Zod pour protéger contre les données invalides
// Réplique les schémas de validation du frontend pour une validation côté serveur

import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// Schémas de base
const uuidSchema = z.string().uuid({ message: "ID invalide" });
const tokenSchema = z.string().min(20, { message: "Token invalide" });

// Validation pour create-transaction
export const createTransactionSchema = z.object({
  title: z.string()
    .min(3, { message: "Le titre doit contenir au moins 3 caractères" })
    .max(100, { message: "Le titre ne peut pas dépasser 100 caractères" }),
  
  description: z.string()
    .min(10, { message: "La description doit contenir au moins 10 caractères" })
    .max(1000, { message: "La description ne peut pas dépasser 1000 caractères" }),
  
  price: z.number()
    .min(1, { message: "Le prix minimum est de 1" })
    .max(1000000, { message: "Le prix ne peut pas dépasser 1 000 000" }),
  
  currency: z.enum(['EUR', 'CHF'], { 
    errorMap: () => ({ message: "Devise invalide (EUR ou CHF uniquement)" })
  }),
  
  paymentDeadlineHours: z.number()
    .refine((hours) => [24, 72, 168].includes(hours), {
      message: "Délai de paiement invalide (24, 72 ou 168 heures uniquement)"
    })
    .optional()
    .default(24),
  
  serviceDate: z.string()
    .refine((date) => {
      const serviceDate = new Date(date);
      const now = new Date();
      const minDate = new Date(now.getTime() + 25 * 60 * 60 * 1000); // +25h
      return serviceDate > minDate;
    }, { message: "La date de service doit être au moins 25h dans le futur" }),
  
  serviceEndDate: z.string().optional()
    .refine((date) => {
      if (!date) return true;
      return !isNaN(new Date(date).getTime());
    }, { message: "Date de fin invalide" }),
  
  clientEmail: z.string()
    .email({ message: "Email invalide" })
    .optional()
    .or(z.literal(''))
    .nullable(),
  
  fee_ratio_client: z.number()
    .min(0, { message: "Le ratio ne peut pas être négatif" })
    .max(100, { message: "Le ratio ne peut pas dépasser 100" })
    .optional()
    .default(0),
});

// Validation pour join-transaction
export const joinTransactionSchema = z.object({
  transaction_id: uuidSchema,
  linkToken: tokenSchema.optional(),
  token: tokenSchema.optional(),
}).refine(
  (data) => data.linkToken || data.token,
  { message: "Token manquant", path: ["linkToken"] }
);

// Validation pour create-dispute
export const createDisputeSchema = z.object({
  transactionId: uuidSchema,
  
  disputeType: z.enum([
    'quality_issue',
    'not_as_described',
    'delivery_issue',
    'unauthorized_transaction',
    'not_received',
    'fraud',
    'other'
  ], { 
    errorMap: () => ({ message: "Type de litige invalide" })
  }).optional(),
  
  reason: z.string()
    .min(20, { message: "La raison doit contenir au moins 20 caractères" })
    .max(2000, { message: "La raison ne peut pas dépasser 2000 caractères" }),
});

// Validation pour create-proposal
export const createProposalSchema = z.object({
  disputeId: uuidSchema,
  
  proposalType: z.enum(['partial_refund', 'full_refund', 'no_refund'], {
    errorMap: () => ({ message: "Type de proposition invalide" })
  }),
  
  refundPercentage: z.number()
    .min(0, { message: "Le pourcentage ne peut pas être négatif" })
    .max(100, { message: "Le pourcentage ne peut pas dépasser 100" })
    .optional(),
  
  message: z.string()
    .max(1000, { message: "Le message ne peut pas dépasser 1000 caractères" })
    .optional(),
});

// Validation pour request-date-change
export const requestDateChangeSchema = z.object({
  transactionId: uuidSchema,
  
  proposedServiceDate: z.string()
    .refine((date) => {
      const newDate = new Date(date);
      return !isNaN(newDate.getTime());
    }, { message: "Date invalide" }),
  
  proposedServiceEndDate: z.string().optional()
    .refine((date) => {
      if (!date) return true;
      return !isNaN(new Date(date).getTime());
    }, { message: "Date de fin invalide" }),
  
  message: z.string()
    .max(500, { message: "Le message ne peut pas dépasser 500 caractères" })
    .optional(),
});

/**
 * Valide les données d'entrée et retourne les données validées ou lance une erreur
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map(err => err.message).join(', ');
      throw new Error(`Données invalides : ${messages}`);
    }
    throw error;
  }
}
