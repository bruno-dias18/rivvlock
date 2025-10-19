import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { 
  compose, 
  withCors, 
  withValidation,
  successResponse, 
  errorResponse,
  Handler, 
  HandlerContext 
} from "../_shared/middleware.ts";
import { Resend } from "npm:resend@4.0.0";
import React from "npm:react@18.3.1";
import { renderAsync } from "npm:@react-email/components@0.0.22";
import { TransactionCreatedEmail } from "./_templates/transaction-created.tsx";
import { PaymentReminderEmail } from "./_templates/payment-reminder.tsx";
import { QuoteCreatedEmail } from "./_templates/quote-created.tsx";
import { logger } from "../_shared/logger.ts";

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

type EmailType = 'transaction_created' | 'payment_reminder' | 'quote_created';

const schema = z.object({
  type: z.enum(['transaction_created', 'payment_reminder', 'quote_created']),
  to: z.string().email(),
  data: z.record(z.any())
});

const maskEmail = (email: string): string => {
  const [local, domain] = email.split('@');
  return `${local.slice(0, 2)}***@${domain}`;
};

const handler: Handler = async (_req, ctx: HandlerContext) => {
  const { body } = ctx;
  const { type, to, data } = body as { type: EmailType; to: string; data: Record<string, any> };

  try {
    logger.log('[SEND-EMAIL] Rendering email template', { type, to: maskEmail(to) });

    let html: string;
    let subject: string;

    if (type === 'transaction_created') {
      html = await renderAsync(React.createElement(TransactionCreatedEmail, data));
      subject = `Nouvelle transaction : ${data.transactionTitle}`;
    } else if (type === 'payment_reminder') {
      html = await renderAsync(React.createElement(PaymentReminderEmail, data));
      const urgencyEmojis: Record<string, string> = { '72h': '⏰', '24h': '🚨', '12h': '🚨', '2h': '⚠️' };
      subject = `${urgencyEmojis[data.urgencyLevel] || '⏰'} Rappel de paiement : ${data.transactionTitle}`;
    } else {
      html = await renderAsync(React.createElement(QuoteCreatedEmail, data));
      subject = `📋 Nouveau devis : ${data.quoteTitle}`;
    }

    const { error: resendError } = await resend.emails.send({
      from: 'RivvLock <onboarding@resend.dev>',
      to: [to],
      subject,
      html,
    });

    if (resendError) {
      logger.log('Resend error', resendError);
      throw new Error(`Failed to send email: ${resendError.message}`);
    }

    return successResponse({ message: 'Email sent successfully' });
  } catch (error: any) {
    logger.error('ERROR in send-email', { message: error.message ?? String(error) });
    return errorResponse(error.message ?? 'Internal error', 500);
  }
};

const composedHandler = compose(
  withCors,
  withValidation(schema)
)(handler);

serve(composedHandler);
