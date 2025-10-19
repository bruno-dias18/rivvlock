import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { 
  compose, 
  withCors, 
  withAuth, 
  withValidation,
  successResponse, 
  errorResponse,
  Handler, 
  HandlerContext 
} from "../_shared/middleware.ts";
import { logger } from "../_shared/logger.ts";

const schema = z.object({
  year: z.number().int().min(2000),
  format: z.enum(['excel', 'pdf'])
});

const handler: Handler = async (_req, ctx: HandlerContext) => {
  const { user, supabaseClient, adminClient, body } = ctx;
  const { year, format } = body;

  try {
    const startDate = new Date(year, 0, 1).toISOString();
    const endDate = new Date(year, 11, 31, 23, 59, 59).toISOString();

    // Fetch all transactions
    const { data: txData, error: txError } = await adminClient!
      .from('transactions')
      .select('*')
      .eq('user_id', user!.id)
      .eq('status', 'validated')
      .neq('refund_status', 'full')
      .not('funds_released_at', 'is', null)
      .gte('funds_released_at', startDate)
      .lte('funds_released_at', endDate)
      .order('funds_released_at', { ascending: false });

    if (txError) throw txError;
    if (!txData || txData.length === 0) {
      return errorResponse('No transactions found for this year', 404);
    }

    const transactionIds = txData.map(t => t.id);

    // Fetch disputes and their accepted proposals
    const { data: disputes } = await adminClient!
      .from('disputes')
      .select('transaction_id, resolution, dispute_proposals(refund_percentage, status, proposal_type)')
      .in('transaction_id', transactionIds);

    // Fetch existing invoices
    let { data: invoices } = await adminClient!
      .from('invoices')
      .select('invoice_number, transaction_id')
      .in('transaction_id', transactionIds);

    // Generate missing invoices automatically
    for (const transaction of txData) {
      const existingInvoice = invoices?.find(inv => inv.transaction_id === transaction.id);
      if (!existingInvoice) {
        logger.info(`Generating missing invoice for transaction ${transaction.id}`);
        try {
          const { data: invoiceData, error: invoiceError } = await supabaseClient!.functions.invoke(
            'generate-invoice-number',
            {
              body: {
                transactionId: transaction.id,
                sellerId: user!.id,
                amount: transaction.price,
                currency: transaction.currency
              }
            }
          );
          if (!invoiceError && (invoiceData as any)?.invoiceNumber) {
            if (!invoices) invoices = [] as any[];
            (invoices as any[]).push({
              invoice_number: (invoiceData as any).invoiceNumber,
              transaction_id: transaction.id
            });
            logger.info(`Invoice ${(invoiceData as any).invoiceNumber} generated for transaction ${transaction.id}`);
          } else {
            logger.error(`Failed to generate invoice for transaction ${transaction.id}:`, invoiceError);
          }
        } catch (err) {
          logger.error(`Error generating invoice for transaction ${transaction.id}:`, err);
        }
      }
    }

    // Create map of refund percentages
    const refundMap = new Map<string, number>();
    (disputes || []).forEach((dispute: any) => {
      const proposals = (dispute.dispute_proposals as any[]) || [];
      const acceptedProposal = proposals.find((p: any) => p.status === 'accepted' && (p.proposal_type === 'partial_refund' || (p.refund_percentage ?? 0) > 0));
      if (acceptedProposal?.refund_percentage) {
        refundMap.set(dispute.transaction_id, Number(acceptedProposal.refund_percentage));
        return;
      }
      if (typeof dispute.resolution === 'string') {
        const m = dispute.resolution.match(/(\d{1,3})\s*%/);
        const pct = m ? parseInt(m[1], 10) : 0;
        if (pct > 0 && pct < 100) {
          refundMap.set(dispute.transaction_id, pct);
        }
      }
    });

    // Enrich transactions with refund_percentage
    const transactions = txData.map((t: any) => ({
      ...t,
      refund_percentage: refundMap.get(t.id) || 0
    }));

    // VAT info
    const { data: sellerProfile } = await adminClient!
      .from('profiles')
      .select('tva_rate, vat_rate, is_subject_to_vat, country')
      .eq('user_id', user!.id)
      .maybeSingle();

    if (format === 'excel') {
      const csv = generateCSV(transactions, invoices || [], sellerProfile);
      return new Response(csv, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="rapport-annuel-${year}.csv"`
        }
      });
    }

    return errorResponse('PDF generation not yet implemented', 501);
  } catch (error: any) {
    logger.error('Error:', error);
    return errorResponse(error.message ?? 'Internal error', 400);
  }
};

function generateCSV(transactions: any[], invoices: any[], sellerProfile: any): string {
  const headers = ['Date de validation', 'N° Facture', 'Client', 'Description', 'Montant HT', 'TVA', 'Montant TTC', 'Frais RivvLock', 'Net reçu', 'Devise'];
  const invoiceMap = new Map(invoices.map((inv: any) => [inv.transaction_id, inv.invoice_number]));

  let vatRate = 0;
  if (sellerProfile?.is_subject_to_vat) {
    if (sellerProfile.country === 'FR' && sellerProfile.tva_rate) {
      vatRate = Number(sellerProfile.tva_rate);
    } else if (sellerProfile.country === 'CH' && sellerProfile.vat_rate) {
      vatRate = Number(sellerProfile.vat_rate);
    }
  }

  const rows = transactions.map((transaction: any) => {
    let amountPaid = Number(transaction.price);
    const pct = Number(transaction.refund_percentage || 0);
    if ((transaction.refund_status === 'partial' || pct > 0) && pct > 0) {
      amountPaid = amountPaid * (1 - pct / 100);
    }

    const amountTTC = amountPaid;
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

const composedHandler = compose(
  withCors,
  withAuth,
  withValidation(schema)
)(handler);

serve(composedHandler);
