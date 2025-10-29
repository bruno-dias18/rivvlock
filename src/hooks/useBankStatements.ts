import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface BankStatement {
  id: string;
  uploaded_by: string;
  file_name: string;
  file_size: number;
  statement_date: string;
  account_iban: string;
  currency: string;
  opening_balance: number | null;
  closing_balance: number | null;
  total_credits: number | null;
  total_debits: number | null;
  raw_xml: string | null;
  parsed_entries: any;
  status: string;
  reconciliation_status: string;
  reconciled_count: number;
  unreconciled_count: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BankReconciliation {
  id: string;
  bank_statement_id: string;
  transaction_id: string | null;
  bank_reference: string;
  bank_amount: number;
  bank_currency: string;
  bank_debtor_name: string | null;
  bank_debtor_iban: string | null;
  value_date: string;
  booking_date: string | null;
  bank_transaction_id: string | null;
  reconciliation_status: string;
  match_confidence: number;
  matched_at: string | null;
  matched_by: string | null;
  matching_method: string | null;
  amount_difference: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  transaction?: any;
}

export const useBankStatements = () => {
  return useQuery({
    queryKey: ['bank-statements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bank_statements')
        .select('*')
        .order('statement_date', { ascending: false });

      if (error) throw error;
      return data as BankStatement[];
    },
  });
};

export const useBankStatementDetails = (statementId: string) => {
  return useQuery({
    queryKey: ['bank-statement', statementId],
    queryFn: async () => {
      const { data: statement, error: stmtError } = await supabase
        .from('bank_statements')
        .select('*')
        .eq('id', statementId)
        .single();

      if (stmtError) throw stmtError;

      const { data: reconciliations, error: recError } = await supabase
        .from('bank_reconciliations')
        .select(`
          *,
          transaction:transactions(*)
        `)
        .eq('bank_statement_id', statementId)
        .order('value_date', { ascending: false });

      if (recError) throw recError;

      return {
        statement: statement as BankStatement,
        reconciliations: reconciliations as BankReconciliation[],
      };
    },
    enabled: !!statementId,
  });
};

export const useUploadBankStatement = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const fileContent = await file.text();

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        throw new Error('No authentication token');
      }

      const response = await fetch(
        `https://slthyxqruhfuyfmextwr.supabase.co/functions/v1/import-bank-statement`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            fileName: file.name,
            fileContent,
            statementType: file.name.toLowerCase().includes('camt054') ? 'camt054' : 'camt053',
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload statement');
      }

      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['bank-statements'] });
      toast.success(
        `Relevé importé avec succès: ${data.matchedCount} transactions réconciliées, ${data.pendingCount} en attente`
      );
    },
    onError: (error) => {
      toast.error(`Erreur lors de l'import: ${error.message}`);
    },
  });
};

export const useManualReconciliation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      reconciliationId,
      transactionId,
    }: {
      reconciliationId: string;
      transactionId: string;
    }) => {
      const { data: userData } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('bank_reconciliations')
        .update({
          transaction_id: transactionId,
          reconciliation_status: 'matched',
          matching_method: 'manual_admin',
          match_confidence: 75,
          matched_at: new Date().toISOString(),
          matched_by: userData.user?.id,
        })
        .eq('id', reconciliationId);

      if (error) throw error;

      // Update transaction
      await supabase
        .from('transactions')
        .update({
          bank_reconciled: true,
          bank_reconciled_at: new Date().toISOString(),
          bank_reconciled_by: userData.user?.id,
        })
        .eq('id', transactionId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-statement'] });
      queryClient.invalidateQueries({ queryKey: ['bank-statements'] });
      toast.success('Transaction rapprochée manuellement');
    },
    onError: (error) => {
      toast.error(`Erreur lors du rapprochement: ${error.message}`);
    },
  });
};
