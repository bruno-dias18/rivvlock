import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { generateInvoicesForTransaction } from '@/components/invoice/AutoInvoiceGenerator';
import { useAuth } from './useAuth';

export const useInvoiceGeneration = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // Listen for transaction status changes to 'paid' or 'completed'
    const channel = supabase
      .channel('invoice_generation')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          console.log('Transaction update detected:', payload);
          
          const newTransaction = payload.new;
          const oldTransaction = payload.old;
          
          // Check if status changed to paid or completed
          if (
            (newTransaction.status === 'paid' || newTransaction.status === 'completed') &&
            oldTransaction.status !== newTransaction.status
          ) {
            console.log('🎯 Transaction status changed to:', newTransaction.status);
            console.log('🧾 Auto-generating invoices for transaction:', newTransaction.id);
            
            try {
              await generateInvoicesForTransaction(newTransaction.id);
              console.log('✅ Invoices generated successfully');
            } catch (error) {
              console.error('❌ Error auto-generating invoices:', error);
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('Invoice generation subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Also listen for buyer transactions
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('buyer_invoice_generation')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'transactions',
          filter: `buyer_id=eq.${user.id}`,
        },
        async (payload) => {
          console.log('Buyer transaction update detected:', payload);
          
          const newTransaction = payload.new;
          const oldTransaction = payload.old;
          
          // Check if status changed to paid or completed
          if (
            (newTransaction.status === 'paid' || newTransaction.status === 'completed') &&
            oldTransaction.status !== newTransaction.status
          ) {
            console.log('🎯 Buyer transaction status changed to:', newTransaction.status);
            console.log('🧾 Auto-generating invoices for buyer transaction:', newTransaction.id);
            
            try {
              await generateInvoicesForTransaction(newTransaction.id);
              console.log('✅ Buyer invoices generated successfully');
            } catch (error) {
              console.error('❌ Error auto-generating buyer invoices:', error);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);
};