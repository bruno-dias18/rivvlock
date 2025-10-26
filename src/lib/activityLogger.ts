import { logger } from '@/lib/logger';

export type ActivityType = 
  | 'transaction_created'
  | 'funds_blocked'
  | 'transaction_validated'
  | 'transaction_joined'
  | 'buyer_joined_transaction'
  | 'seller_validation'
  | 'buyer_validation'
  | 'profile_updated'
  | 'dispute_created'
  | 'dispute_message_received'
  | 'dispute_proposal_created'
  | 'dispute_proposal_accepted'
  | 'dispute_proposal_rejected'
  | 'dispute_admin_message'
  | 'dispute_status_changed'
  | 'funds_released'
  | 'transaction_completed'
  | 'transaction_deleted';

interface LogActivityParams {
  type: ActivityType;
  title: string;
  description?: string;
  metadata?: Record<string, any>;
}

// Sanitize metadata to remove sensitive fields
const sanitizeLogMetadata = (metadata: Record<string, any>): Record<string, any> => {
  const sanitized = { ...metadata };
  
  // Remove sensitive fields that shouldn't be logged
  const sensitiveFields = [
    'password', 'token', 'key', 'secret', 'stripe_customer_id', 
    'stripe_account_id', 'payment_intent_id', 'phone', 'email',
    'first_name', 'last_name', 'address', 'postal_code', 'city',
    'siret_uid', 'vat_number', 'avs_number', 'company_address'
  ];
  
  sensitiveFields.forEach(field => {
    delete sanitized[field];
  });
  
  return sanitized;
};

export const logActivity = async ({ type, title, description, metadata }: LogActivityParams) => {
  try {
    const { supabase } = await import('@/integrations/supabase/client');
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      logger.warn('Cannot log activity: user not authenticated');
      return;
    }

    // Sanitize metadata to remove sensitive data before logging
    const sanitizedMetadata = sanitizeLogMetadata(metadata || {});
    
    const { error } = await supabase
      .from('activity_logs')
      .insert({
        user_id: user.id,
        activity_type: type,
        title,
        description,
        metadata: sanitizedMetadata
      });

    if (error) {
      logger.error('Error logging activity:', error);
    }
  } catch (error) {
    logger.error('Error in logActivity:', error);
  }
};