import { supabase } from '@/integrations/supabase/client';

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
  | 'funds_released'
  | 'transaction_completed'
  | 'transaction_deleted';

interface LogActivityParams {
  type: ActivityType;
  title: string;
  description?: string;
  metadata?: Record<string, any>;
}

export const logActivity = async ({ type, title, description, metadata }: LogActivityParams) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.warn('Cannot log activity: user not authenticated');
      return;
    }

    const { error } = await supabase
      .from('activity_logs')
      .insert({
        user_id: user.id,
        activity_type: type,
        title,
        description,
        metadata: metadata || {}
      });

    if (error) {
      console.error('Error logging activity:', error);
    }
  } catch (error) {
    console.error('Error in logActivity:', error);
  }
};