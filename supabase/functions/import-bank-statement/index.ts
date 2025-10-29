import { createServiceClient } from '../_shared/supabase-utils.ts';
import { parseCamt053, parseCamt054, validateQrReference, type CamtStatement } from '../_shared/camt-parser.ts';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Request schema
const ImportRequestSchema = z.object({
  fileName: z.string().min(1),
  fileContent: z.string().min(1),
  statementType: z.enum(['camt053', 'camt054']).default('camt053'),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createServiceClient();

    // Verify admin authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check admin role
    const { data: isAdmin, error: roleError } = await supabase.rpc('is_admin', { check_user_id: user.id });
    
    if (roleError || !isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body = await req.json();
    const validatedData = ImportRequestSchema.parse(body);

    console.log(`Processing bank statement import: ${validatedData.fileName}`);

    // Decode base64 if needed
    let xmlContent = validatedData.fileContent;
    if (!xmlContent.includes('<?xml')) {
      try {
        xmlContent = atob(xmlContent);
      } catch {
        // Not base64, use as is
      }
    }

    // Parse XML based on type
    let parsedStatement: CamtStatement;
    try {
      if (validatedData.statementType === 'camt054') {
        parsedStatement = parseCamt054(xmlContent);
      } else {
        parsedStatement = parseCamt053(xmlContent);
      }
    } catch (parseError) {
      console.error('XML parsing error:', parseError);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid XML format', 
          details: parseError instanceof Error ? parseError.message : 'Unknown error' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Parsed ${parsedStatement.transactions.length} transactions from statement`);

    // Insert bank statement
    const { data: statement, error: insertError } = await supabase
      .from('bank_statements')
      .insert({
        uploaded_by: user.id,
        file_name: validatedData.fileName,
        file_size: xmlContent.length,
        statement_date: parsedStatement.statementDate,
        account_iban: parsedStatement.accountIban,
        currency: parsedStatement.currency,
        opening_balance: parsedStatement.openingBalance,
        closing_balance: parsedStatement.closingBalance,
        raw_xml: xmlContent,
        parsed_entries: parsedStatement.transactions,
        status: 'processing',
      })
      .select()
      .single();

    if (insertError || !statement) {
      console.error('Failed to insert bank statement:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to save bank statement', details: insertError?.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Bank statement saved with ID: ${statement.id}`);

    // Process reconciliation
    let matchedCount = 0;
    let pendingCount = 0;
    const unmatchedReferences: string[] = [];

    for (const transaction of parsedStatement.transactions) {
      // Only process credits (incoming payments)
      if (transaction.amount <= 0) {
        continue;
      }

      // Validate QR reference if present
      if (transaction.reference && !validateQrReference(transaction.reference)) {
        console.warn(`Invalid QR reference format: ${transaction.reference}`);
        unmatchedReferences.push(transaction.reference);
        pendingCount++;
        continue;
      }

      // Try to match with existing transaction by QR reference
      let matchedTransaction = null;
      let matchConfidence = 0;
      let matchingMethod = 'pending';

      if (transaction.reference) {
        const { data: txData } = await supabase
          .from('transactions')
          .select('*')
          .eq('payment_reference', transaction.reference)
          .eq('status', 'paid')
          .single();

        if (txData) {
          matchedTransaction = txData;
          matchConfidence = 100;
          matchingMethod = 'auto_qr_reference';
          matchedCount++;
          console.log(`Matched transaction ${txData.id} with QR reference ${transaction.reference}`);
        } else {
          unmatchedReferences.push(transaction.reference);
          pendingCount++;
        }
      } else {
        pendingCount++;
      }

      // Insert reconciliation record
      const { error: reconError } = await supabase
        .from('bank_reconciliations')
        .insert({
          bank_statement_id: statement.id,
          transaction_id: matchedTransaction?.id,
          bank_reference: transaction.reference || '',
          bank_amount: transaction.amount,
          bank_currency: transaction.currency,
          bank_debtor_name: transaction.debtorName,
          bank_debtor_iban: transaction.debtorIban,
          value_date: transaction.valueDate,
          booking_date: transaction.bookingDate,
          bank_transaction_id: transaction.transactionId,
          reconciliation_status: matchedTransaction ? 'matched' : 'pending',
          match_confidence: matchConfidence,
          matching_method: matchingMethod,
          matched_at: matchedTransaction ? new Date().toISOString() : null,
          matched_by: matchedTransaction ? user.id : null,
        });

      if (reconError) {
        console.error('Failed to insert reconciliation:', reconError);
      }

      // Update transaction if matched
      if (matchedTransaction) {
        await supabase
          .from('transactions')
          .update({
            bank_reconciled: true,
            bank_reconciled_at: new Date().toISOString(),
            bank_reconciled_by: user.id,
          })
          .eq('id', matchedTransaction.id);
      }
    }

    // Update statement status
    await supabase
      .from('bank_statements')
      .update({
        status: 'completed',
        reconciliation_status: pendingCount > 0 ? 'in_progress' : 'completed',
        reconciled_count: matchedCount,
        unreconciled_count: pendingCount,
      })
      .eq('id', statement.id);

    console.log(`Reconciliation complete: ${matchedCount} matched, ${pendingCount} pending`);

    return new Response(
      JSON.stringify({
        statementId: statement.id,
        totalTransactions: parsedStatement.transactions.length,
        matchedCount,
        pendingCount,
        unmatchedReferences,
        summary: {
          accountIban: parsedStatement.accountIban,
          statementDate: parsedStatement.statementDate,
          openingBalance: parsedStatement.openingBalance,
          closingBalance: parsedStatement.closingBalance,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Import error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
