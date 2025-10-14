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
      .select('transaction_id, resolution, dispute_proposals(refund_percentage, status, proposal_type)')
      .in('transaction_id', transactionIds);
    
    // Fetch existing invoices
    let { data: invoices } = await supabase
      .from('invoices')
      .select('invoice_number, transaction_id')
      .in('transaction_id', transactionIds);
    
    // Generate missing invoices automatically
    for (const transaction of txData) {
      const existingInvoice = invoices?.find(inv => inv.transaction_id === transaction.id);
      
      if (!existingInvoice) {
        logger.info(`Generating missing invoice for transaction ${transaction.id}`);
        
        try {
          // Call the generate-invoice-number function
          const { data: invoiceData, error: invoiceError } = await supabase.functions.invoke(
            'generate-invoice-number',
            {
              body: {
                transactionId: transaction.id,
                sellerId: user.id,
                amount: transaction.price,
                currency: transaction.currency
              }
            }
          );
          
          if (!invoiceError && invoiceData?.invoiceNumber) {
            // Add to invoices array
            if (!invoices) invoices = [];
            invoices.push({
              invoice_number: invoiceData.invoiceNumber,
              transaction_id: transaction.id
            });
            logger.info(`Invoice ${invoiceData.invoiceNumber} generated for transaction ${transaction.id}`);
          } else {
            logger.error(`Failed to generate invoice for transaction ${transaction.id}:`, invoiceError);
          }
        } catch (err) {
          logger.error(`Error generating invoice for transaction ${transaction.id}:`, err);
        }
      }
    }
    
    // Create map of refund percentages
    const refundMap = new Map();
    disputes?.forEach(dispute => {
      const proposals = (dispute.dispute_proposals as any[]) || [];
      const acceptedProposal = proposals.find((p: any) => p.status === 'accepted' && (p.proposal_type === 'partial_refund' || (p.refund_percentage ?? 0) > 0));
      if (acceptedProposal?.refund_percentage) {
        refundMap.set(dispute.transaction_id, Number(acceptedProposal.refund_percentage));
        return;
      }
      // Fallback: parse percentage from resolution text (e.g., "Remboursement 30%")
      if ((dispute as any).resolution && typeof (dispute as any).resolution === 'string') {
        const m = (dispute as any).resolution.match(/(\d{1,3})\s*%/);
        const pct = m ? parseInt(m[1], 10) : 0;
        if (pct > 0 && pct < 100) {
          refundMap.set(dispute.transaction_id, pct);
        }
      }
    });
    
    // Enrich transactions with refund_percentage
    const transactions = txData.map(t => ({
      ...t,
      refund_percentage: refundMap.get(t.id) || 0
    }));

    // Récupérer le profil du vendeur pour les taux de TVA
    const { data: sellerProfile } = await supabase
      .from('profiles')
      .select('tva_rate, vat_rate, is_subject_to_vat, country')
      .eq('user_id', user.id)
      .single();

    if (format === 'excel') {
      const csv = generateCSV(transactions, invoices || [], sellerProfile);
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

function generateCSV(transactions: any[], invoices: any[], sellerProfile: any): string {
  const headers = ['Date de validation', 'N° Facture', 'Client', 'Description', 'Montant HT', 'TVA', 'Montant TTC', 'Frais RivvLock', 'Net reçu', 'Devise'];
  
  const invoiceMap = new Map(invoices.map(inv => [inv.transaction_id, inv.invoice_number]));
  
  // Déterminer le taux de TVA applicable
  let vatRate = 0;
  if (sellerProfile?.is_subject_to_vat) {
    if (sellerProfile.country === 'FR' && sellerProfile.tva_rate) {
      vatRate = Number(sellerProfile.tva_rate);
    } else if (sellerProfile.country === 'CH' && sellerProfile.vat_rate) {
      vatRate = Number(sellerProfile.vat_rate);
    }
  }
  
  const rows = transactions.map(transaction => {
    // Calculer le montant réel après remboursement partiel
    let amountPaid = Number(transaction.price);
    const pct = Number(transaction.refund_percentage || 0);
    if ((transaction.refund_status === 'partial' || pct > 0) && pct > 0) {
      amountPaid = amountPaid * (1 - pct / 100);
    }
    
    // Le prix de la transaction est le montant TTC (ce que le client a payé)
    const amountTTC = amountPaid;
    // Décomposer pour trouver le HT et la TVA
    const amountHT = vatRate > 0 ? amountTTC / (1 + vatRate / 100) : amountTTC;
    const vatAmount = amountTTC - amountHT;
    
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
      amountHT.toFixed(2),
      vatAmount.toFixed(2),
      amountTTC.toFixed(2),
      rivvlockFee.toFixed(2),
      amountReceived.toFixed(2),
      transaction.currency.toUpperCase()
    ].join(';');
  });
  
  return [headers.join(';'), ...rows].join('\n');
}
