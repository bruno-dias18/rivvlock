import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { logger } from "../_shared/logger.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { year, format } = await req.json();

    if (!year || !format) {
      throw new Error('Missing required parameters');
    }

    const startDate = new Date(year, 0, 1).toISOString();
    const endDate = new Date(year, 11, 31, 23, 59, 59).toISOString();

    // Fetch all transactions
    const { data: txData, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'validated')
      .neq('refund_status', 'full')
      .gte('updated_at', startDate)
      .lte('updated_at', endDate)
      .order('updated_at', { ascending: false });

    if (txError) throw txError;
    if (!txData || txData.length === 0) {
      throw new Error('No transactions found for this year');
    }
    
    const transactionIds = txData.map(t => t.id);
    
    // Fetch disputes and their accepted proposals
    const { data: disputes } = await supabase
      .from('disputes')
      .select('transaction_id, dispute_proposals(refund_percentage, status)')
      .in('transaction_id', transactionIds);
    
    // Create map of refund percentages
    const refundMap = new Map();
    disputes?.forEach(dispute => {
      const acceptedProposal = (dispute.dispute_proposals as any)?.find((p: any) => p.status === 'accepted');
      if (acceptedProposal?.refund_percentage) {
        refundMap.set(dispute.transaction_id, acceptedProposal.refund_percentage);
      }
    });
    
    // Enrich transactions with refund_percentage
    const transactions = txData.map(t => ({
      ...t,
      refund_percentage: refundMap.get(t.id) || 0
    }));

    const { data: invoices } = await supabase
      .from('invoices')
      .select('invoice_number, transaction_id')
      .in('transaction_id', transactionIds);

    if (format === 'excel') {
      const csv = generateCSV(transactions, invoices || []);
      return new Response(csv, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="rapport-annuel-${year}.csv"`
        }
      });
    }

    return new Response(JSON.stringify({ error: 'PDF generation not yet implemented' }), {
      status: 501,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    logger.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

function generateCSV(transactions: any[], invoices: any[]): string {
  const headers = ['Date de validation', 'N° Facture', 'Client', 'Description', 'Montant HT', 'TVA', 'Montant TTC', 'Frais RivvLock', 'Net reçu', 'Devise'];
  
  const invoiceMap = new Map(invoices.map(inv => [inv.transaction_id, inv.invoice_number]));
  
  const rows = transactions.map(transaction => {
    // Calculer le montant réel après remboursement partiel
    let amountPaid = Number(transaction.price);
    if (transaction.refund_status === 'partial' && transaction.refund_percentage) {
      amountPaid = amountPaid * (1 - transaction.refund_percentage / 100);
    }
    const rivvlockFee = amountPaid * 0.05;
    const amountReceived = amountPaid - rivvlockFee;
    const invoiceNumber = invoiceMap.get(transaction.id) || '-';
    
    const date = new Date(transaction.updated_at).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    
    return [
      date,
      invoiceNumber,
      transaction.buyer_display_name || '-',
      `"${(transaction.description || transaction.title).replace(/"/g, '""')}"`,
      amountPaid.toFixed(2),
      '0.00',
      amountPaid.toFixed(2),
      rivvlockFee.toFixed(2),
      amountReceived.toFixed(2),
      transaction.currency.toUpperCase()
    ].join(';');
  });
  
  return [headers.join(';'), ...rows].join('\n');
}
