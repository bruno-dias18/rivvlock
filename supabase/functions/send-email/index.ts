import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@4.0.0";
import React from "npm:react@18.3.1";
import { renderAsync } from "npm:@react-email/components@0.0.22";
import { TransactionCreatedEmail } from "./_templates/transaction-created.tsx";
import { PaymentReminderEmail } from "./_templates/payment-reminder.tsx";
import { QuoteCreatedEmail } from "./_templates/quote-created.tsx";
import { logger } from "../_shared/logger.ts";

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type EmailType = 'transaction_created' | 'payment_reminder' | 'quote_created';

interface EmailPayload {
  type: EmailType;
  to: string;
  data: Record<string, any>;
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  logger.log(`[SEND-EMAIL] ${step}${detailsStr}`);
};

const maskEmail = (email: string): string => {
  const [local, domain] = email.split('@');
  return `${local.slice(0, 2)}***@${domain}`;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep('Email function invoked');

    const { type, to, data }: EmailPayload = await req.json();

    if (!type || !to) {
      throw new Error('Missing required fields: type, to');
    }

    logStep('Rendering email template', { type, to: maskEmail(to) });

    let html: string;
    let subject: string;

    if (type === 'transaction_created') {
      html = await renderAsync(
        React.createElement(TransactionCreatedEmail, data)
      );
      subject = `Nouvelle transaction : ${data.transactionTitle}`;
    } else if (type === 'payment_reminder') {
      html = await renderAsync(
        React.createElement(PaymentReminderEmail, data)
      );
      const urgencyEmojis: Record<string, string> = {
        '72h': '⏰',
        '24h': '🚨',
        '12h': '🚨',
        '2h': '⚠️'
      };
      subject = `${urgencyEmojis[data.urgencyLevel] || '⏰'} Rappel de paiement : ${data.transactionTitle}`;
    } else if (type === 'quote_created') {
      html = await renderAsync(
        React.createElement(QuoteCreatedEmail, data)
      );
      subject = `📋 Nouveau devis : ${data.quoteTitle}`;
    } else {
      throw new Error(`Unknown email type: ${type}`);
    }

    logStep('Sending email via Resend', { subject });

    const { error: resendError } = await resend.emails.send({
      from: 'RivvLock <onboarding@resend.dev>',
      to: [to],
      subject,
      html,
    });

    if (resendError) {
      logStep('Resend error', resendError);
      throw new Error(`Failed to send email: ${resendError.message}`);
    }

    logStep('Email sent successfully', { to: maskEmail(to), type });

    return new Response(
      JSON.stringify({ success: true, message: 'Email sent successfully' }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep('ERROR in send-email', { message: errorMessage });
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        success: false 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
