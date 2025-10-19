import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logger } from "../_shared/logger.ts";
import { 
  compose, 
  withCors,
  successResponse, 
  errorResponse,
  Handler, 
  HandlerContext 
} from "../_shared/middleware.ts";

/**
 * GDPR/nLPD Data Retention Compliance Function
 * 
 * Automatically purges data older than 10 years to comply with:
 * - GDPR Art. 5.1.e (storage limitation)
 * - nLPD Art. 6 al. 3 (proportionate retention)
 * - Commercial codes (FR: Art. L123-22, CH: Art. 958f CO)
 * 
 * Schedule: Run monthly via cron job
 * 
 * Data retention periods:
 * - Transactions & Invoices: 10 years (legal requirement)
 * - Messages: 10 years (linked to transactions)
 * - Disputes: 10 years (linked to transactions)
 * - Activity logs: 1 year (operational data)
 * - Access logs: 1 year (security data)
 */

const handler: Handler = async (req, ctx: HandlerContext) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify this is an admin or cron job
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
        authHeader.replace('Bearer ', '')
      );
      
      if (authError || !user) {
        return errorResponse('Unauthorized', 401);
      }

      const { data: adminCheck } = await supabaseAdmin
        .from('admin_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .single();

      if (!adminCheck) {
        return errorResponse('Admin access required', 403);
      }
    }

    logger.log('🧹 Starting GDPR data retention cleanup...');

    const results = {
      invoices_deleted: 0,
      transactions_deleted: 0,
      disputes_deleted: 0,
      messages_deleted: 0,
      activity_logs_deleted: 0,
      access_logs_deleted: 0,
      errors: [] as string[]
    };

    // Calculate cutoff dates
    const tenYearsAgo = new Date();
    tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
    
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    logger.log(`📅 10-year cutoff: ${tenYearsAgo.toISOString()}`);
    logger.log(`📅 1-year cutoff: ${oneYearAgo.toISOString()}`);

    // 1. Delete old invoices (10 years)
    try {
      const { data: oldInvoices, error: invoiceError } = await supabaseAdmin
        .from('invoices')
        .delete()
        .lt('generated_at', tenYearsAgo.toISOString())
        .select('id');

      if (invoiceError) throw invoiceError;
      results.invoices_deleted = oldInvoices?.length || 0;
      logger.log(`✅ Deleted ${results.invoices_deleted} invoices older than 10 years`);
    } catch (error) {
      const msg = `Invoice deletion error: ${error}`;
      logger.error(`❌ ${msg}`);
      results.errors.push(msg);
    }

    // 2. Delete old completed/resolved transactions (10 years)
    try {
      const { data: oldTransactions, error: txError } = await supabaseAdmin
        .from('transactions')
        .delete()
        .lt('created_at', tenYearsAgo.toISOString())
        .in('status', ['validated', 'expired'])
        .select('id');

      if (txError) throw txError;
      results.transactions_deleted = oldTransactions?.length || 0;
      logger.log(`✅ Deleted ${results.transactions_deleted} transactions older than 10 years`);
    } catch (error) {
      const msg = `Transaction deletion error: ${error}`;
      logger.error(`❌ ${msg}`);
      results.errors.push(msg);
    }

    // 3. Delete old resolved disputes (10 years)
    try {
      const { data: oldDisputes, error: disputeError } = await supabaseAdmin
        .from('disputes')
        .delete()
        .lt('created_at', tenYearsAgo.toISOString())
        .in('status', ['resolved', 'resolved_refund', 'resolved_release'])
        .select('id');

      if (disputeError) throw disputeError;
      results.disputes_deleted = oldDisputes?.length || 0;
      logger.log(`✅ Deleted ${results.disputes_deleted} disputes older than 10 years`);
    } catch (error) {
      const msg = `Dispute deletion error: ${error}`;
      logger.error(`❌ ${msg}`);
      results.errors.push(msg);
    }

    // 4. Delete old transaction messages (10 years)
    try {
      const { data: oldMessages, error: msgError } = await supabaseAdmin
        .from('transaction_messages')
        .delete()
        .lt('created_at', tenYearsAgo.toISOString())
        .select('id');

      if (msgError) throw msgError;
      results.messages_deleted = oldMessages?.length || 0;
      logger.log(`✅ Deleted ${results.messages_deleted} messages older than 10 years`);
    } catch (error) {
      const msg = `Message deletion error: ${error}`;
      logger.error(`❌ ${msg}`);
      results.errors.push(msg);
    }

    // 5. Delete old activity logs (1 year - operational data)
    try {
      const { data: oldLogs, error: logError } = await supabaseAdmin
        .from('activity_logs')
        .delete()
        .lt('created_at', oneYearAgo.toISOString())
        .select('id');

      if (logError) throw logError;
      results.activity_logs_deleted = oldLogs?.length || 0;
      logger.log(`✅ Deleted ${results.activity_logs_deleted} activity logs older than 1 year`);
    } catch (error) {
      const msg = `Activity log deletion error: ${error}`;
      logger.error(`❌ ${msg}`);
      results.errors.push(msg);
    }

    // 6. Delete old access logs (1 year - security data)
    try {
      const { data: oldAccessLogs, error: accessError } = await supabaseAdmin
        .from('profile_access_logs')
        .delete()
        .lt('created_at', oneYearAgo.toISOString())
        .select('id');

      if (accessError) throw accessError;
      results.access_logs_deleted = oldAccessLogs?.length || 0;
      logger.log(`✅ Deleted ${results.access_logs_deleted} access logs older than 1 year`);
    } catch (error) {
      const msg = `Access log deletion error: ${error}`;
      logger.error(`❌ ${msg}`);
      results.errors.push(msg);
    }

    // 7. Clean old audit logs
    try {
      await supabaseAdmin
        .from('security_audit_log')
        .delete()
        .lt('created_at', oneYearAgo.toISOString());
      logger.log('✅ Cleaned security audit logs');
    } catch (error) {
      logger.error(`❌ Security audit cleanup error: ${error}`);
    }

    const totalDeleted = results.invoices_deleted + 
                         results.transactions_deleted + 
                         results.disputes_deleted + 
                         results.messages_deleted + 
                         results.activity_logs_deleted + 
                         results.access_logs_deleted;

    logger.log(`✅ GDPR cleanup completed: ${totalDeleted} records deleted`);

    return successResponse({
      message: 'GDPR data retention cleanup completed',
      timestamp: new Date().toISOString(),
      cutoff_dates: {
        legal_documents: tenYearsAgo.toISOString(),
        operational_logs: oneYearAgo.toISOString()
      },
      results,
      compliance: {
        regulations: ['GDPR Art. 5.1.e', 'nLPD Art. 6 al. 3', 'Commercial codes'],
        retention_periods: {
          'transactions_invoices_disputes': '10 years',
          'operational_logs': '1 year'
        }
      }
    });

  } catch (error) {
    logger.error('❌ GDPR cleanup error:', error);
    return errorResponse(
      error instanceof Error ? error.message : String(error),
      500
    );
  }
};

const composedHandler = compose(withCors)(handler);
serve(composedHandler);
