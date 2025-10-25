import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formate un numéro AVS pour l'affichage avec points (756.XXXX.XXXX.XX)
 * En DB: stocké sans points (7561234567890)
 * À l'affichage: avec points (756.1234.5678.90)
 */
export function formatAvsDisplay(avs: string | null | undefined): string {
  if (!avs) return '';
  // Enlever tous les caractères non-numériques
  const cleaned = avs.replace(/\D/g, '');
  // Vérifier la longueur (doit être 13 chiffres)
  if (cleaned.length !== 13) return avs; // Retourner tel quel si format invalide
  // Appliquer le format: 756.XXXX.XXXX.XX
  return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 7)}.${cleaned.slice(7, 11)}.${cleaned.slice(11)}`;
}
