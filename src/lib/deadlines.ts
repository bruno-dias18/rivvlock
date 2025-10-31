import { Transaction } from '@/types';

export interface EffectiveDeadlines {
  card: Date | null;
  bank: Date | null;
}

export type PaymentPhase = 'bank_active' | 'card_active' | 'expired';

export interface DeadlineStatus {
  phase: PaymentPhase;
  activeDeadline: Date | null;
  isBankExpired: boolean;
  isCardExpired: boolean;
  deadlines: EffectiveDeadlines;
}

/**
 * Calculate effective payment deadlines with fallback logic
 */
export function getEffectiveDeadlines(transaction: Transaction): EffectiveDeadlines {
  // Card deadline: use payment_deadline_card or fall back to payment_deadline
  const card = transaction.payment_deadline_card 
    ? new Date(transaction.payment_deadline_card)
    : transaction.payment_deadline 
      ? new Date(transaction.payment_deadline)
      : null;

  // Bank deadline: use payment_deadline_bank or calculate from service_date or card deadline
  let bank: Date | null = null;
  
  if (transaction.payment_deadline_bank) {
    bank = new Date(transaction.payment_deadline_bank);
  } else if (transaction.service_date) {
    // Calculate: service_date - 96 hours
    const serviceDate = new Date(transaction.service_date);
    bank = new Date(serviceDate.getTime() - 96 * 60 * 60 * 1000);
  } else if (card) {
    // Calculate: card deadline - 72 hours
    bank = new Date(card.getTime() - 72 * 60 * 60 * 1000);
  }

  return { card, bank };
}

/**
 * Determine the current payment phase based on deadlines
 */
export function getActivePaymentPhase(
  now: Date,
  bankDeadline: Date | null,
  cardDeadline: Date | null
): PaymentPhase {
  if (bankDeadline && now < bankDeadline) {
    return 'bank_active';
  }
  
  if (cardDeadline && now < cardDeadline) {
    return 'card_active';
  }
  
  return 'expired';
}

/**
 * Get complete deadline status for a transaction
 */
export function getDeadlineStatus(transaction: Transaction): DeadlineStatus {
  const deadlines = getEffectiveDeadlines(transaction);
  const now = new Date();
  
  const isBankExpired = deadlines.bank ? now >= deadlines.bank : true;
  const isCardExpired = deadlines.card ? now >= deadlines.card : true;
  
  const phase = getActivePaymentPhase(now, deadlines.bank, deadlines.card);
  
  const activeDeadline = phase === 'bank_active' 
    ? deadlines.bank 
    : phase === 'card_active' 
      ? deadlines.card 
      : null;

  return {
    phase,
    activeDeadline,
    isBankExpired,
    isCardExpired,
    deadlines,
  };
}
