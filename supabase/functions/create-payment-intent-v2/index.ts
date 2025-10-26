import Stripe from "https://esm.sh/stripe@18.5.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { logger } from "../_shared/logger.ts";
import { 
  compose, 
  withCors, 
  withAuth, 
  withRateLimit,
  withValidation,
  successResponse, 
  errorResponse,
  Handler, 
  HandlerContext 
} from "../_shared/middleware.ts";

/**
 * Validation schema for payment intent creation V2
 */
const schema = z.object({
  transactionId: z.string().uuid(),
  paymentMethod: z.enum(['card', 'sepa_debit', 'bank_transfer', 'twint']).optional(),
});

/**
 * Create Stripe Payment Intent V2 with Customer Balance (Virtual IBAN)
 * 
 * NEW FEATURES:
 * - Génère un IBAN virtuel Stripe via Customer Balance
 * - Support Twint (CHF uniquement)
 * - Support SEPA Direct Debit (72h minimum)
 * - Support carte (toujours disponible)
 * 
 * ESCROW GARANTI:
 * - Card/Twint: capture_method='manual' → fonds autorisés mais pas capturés
 * - Bank Transfer: Customer Balance → fonds sur Stripe, crédités à la transaction
 * - SEPA: capture_method='manual' → fonds autorisés après 1-3 jours
 * 
 * @param {Request} req - HTTP request
 * @param {HandlerContext} ctx - Context with user, clients, and validated body
 * @returns {Promise<Response>} Success with clientSecret + virtualIBAN or error
 */
const handler: Handler = async (req, ctx: HandlerContext) => {
  const { user, adminClient, body } = ctx;
  const { transactionId, paymentMethod } = body;
  
  try {
    logger.log("🔍 [CREATE-PAYMENT-V2] Creating payment intent for transaction:", transactionId);
    logger.log("✅ [CREATE-PAYMENT-V2] User authenticated:", user!.id);

    // Get transaction details
    const { data: transaction, error: transactionError } = await adminClient!
      .from("transactions")
      .select("*")
      .eq("id", transactionId)
      .single();

    if (transactionError || !transaction) {
      logger.error("❌ [CREATE-PAYMENT-V2] Transaction not found:", transactionError);
      return errorResponse("Transaction not found", 404);
    }

    // Verify user is the buyer
    if (transaction.buyer_id !== user!.id) {
      logger.error("❌ [CREATE-PAYMENT-V2] User is not the buyer");
      return errorResponse("Only the buyer can create payment intent", 403);
    }

    logger.log("✅ [CREATE-PAYMENT-V2] Transaction found, buyer verified");

    // Calculate time until payment deadline
    const paymentDeadline = transaction.payment_deadline 
      ? new Date(transaction.payment_deadline) 
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const now = new Date();
    const timeUntilDeadline = paymentDeadline.getTime() - now.getTime();
    const hoursUntilDeadline = timeUntilDeadline / (1000 * 60 * 60);
    
    logger.log(`⏰ [CREATE-PAYMENT-V2] Payment deadline: ${paymentDeadline.toISOString()}, hours until: ${hoursUntilDeadline.toFixed(2)}`);

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2024-06-20",
    });

    // Get buyer profile
    const { data: buyerProfile } = await adminClient!
      .from("profiles")
      .select("stripe_customer_id, first_name, last_name, country")
      .eq("user_id", user!.id)
      .single();

    logger.log("✅ [CREATE-PAYMENT-V2] Buyer profile found:", buyerProfile?.stripe_customer_id ? "with Stripe customer" : "without Stripe customer");

    /**
     * PAYMENT METHODS AVAILABILITY (V2)
     * 
     * 1. Card: Toujours disponible (instant)
     * 2. SEPA Direct Debit: Seulement si deadline >= 72h (1-3 jours)
     * 3. Bank Transfer (Customer Balance): Si paymentMethod='bank_transfer' demandé
     * 
     * NOTE: Twint is NOT supported - incompatible with escrow (direct to seller)
     */
    const paymentMethodTypes = ['card'];
    const currency = transaction.currency.toLowerCase();
    
    // SEPA Direct Debit si deadline permet
    if (hoursUntilDeadline >= 72) {
      paymentMethodTypes.push('sepa_debit');
      logger.log("✅ [CREATE-PAYMENT-V2] SEPA Direct Debit available (deadline > 3 days)");
    } else {
      logger.log("⚠️ [CREATE-PAYMENT-V2] SEPA Direct Debit blocked (deadline < 3 days)");
    }

    // Validation devise pour SEPA Direct Debit
    if (paymentMethod === 'sepa_debit' && currency !== 'eur') {
      logger.error("❌ [CREATE-PAYMENT-V2] SEPA Direct Debit requires EUR currency", { currency });
      return errorResponse("Le prélèvement SEPA est uniquement possible en EUR. Veuillez payer par carte ou changer la devise en EUR.", 400);
    }
 
    /**
     * CUSTOMER BALANCE (Virtual IBAN pour virement manuel)
     * 
     * Si paymentMethod = 'bank_transfer':
     * 1. Créer/récupérer Stripe Customer
     * 2. Générer un Customer Balance Funding Instructions
     * 3. Retourner l'IBAN virtuel Stripe
     * 
     * L'utilisateur vire vers cet IBAN → Stripe crédite automatiquement
     * → Webhook customer.balance.updated → On met transaction "blocked"
     */
    let virtualIBAN = null;
    let stripeCustomerId = buyerProfile?.stripe_customer_id;

    // Créer Stripe Customer si n'existe pas
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user!.email,
        name: `${buyerProfile?.first_name || ''} ${buyerProfile?.last_name || ''}`.trim(),
        metadata: {
          user_id: user!.id,
          platform: 'rivvlock',
        },
      });
      stripeCustomerId = customer.id;
      
      // Update profile avec customer ID
      await adminClient!
        .from("profiles")
        .update({ stripe_customer_id: stripeCustomerId })
        .eq("user_id", user!.id);
      
      logger.log("✅ [CREATE-PAYMENT-V2] Stripe customer created:", stripeCustomerId);
    }

    // Générer virtual IBAN si bank_transfer demandé
    if (paymentMethod === 'bank_transfer') {
      if (hoursUntilDeadline < 48) {
        logger.error("❌ [CREATE-PAYMENT-V2] Bank transfer requires 48h deadline");
        return errorResponse("Bank transfer requires at least 48 hours before payment deadline", 400);
      }

      try {
        // Pré-validation devise & pays pour SEPA (Customer Balance)
        const fundingCurrency = 'eur';
        if (currency !== fundingCurrency) {
          logger.error("❌ [CREATE-PAYMENT-V2] Bank transfer/SEPA requires EUR currency", { currency });
          return errorResponse("Le virement SEPA n'est disponible qu'en EUR. Veuillez payer par carte/SEPA Direct Debit ou changer la devise en EUR.", 400);
        }

        const supportedEUCountries = ['DE','FR','NL','ES','IE','BE','AT','IT','LU','PT','FI'];
        const buyerCountry = (buyerProfile?.country as string | undefined) ?? 'DE';
        const euCountry = supportedEUCountries.includes(buyerCountry) ? buyerCountry : 'DE';

        logger.log("🔍 [CREATE-PAYMENT-V2] Attempting to create funding instructions...", {
          customer: stripeCustomerId,
          currency: fundingCurrency,
          hoursUntilDeadline: hoursUntilDeadline.toFixed(2),
          euCountry,
        });

        // Créer Customer Balance Funding Instructions (SEPA)
        const fundingInstructions = await stripe.customers.createFundingInstructions(
          stripeCustomerId!,
          {
            bank_transfer: {
              type: 'eu_bank_transfer',
              eu_bank_transfer: { country: euCountry },
            },
            currency: fundingCurrency,
            funding_type: 'bank_transfer',
          }
        );

        logger.log("✅ [CREATE-PAYMENT-V2] Funding instructions created:", JSON.stringify(fundingInstructions));

        // Extraire l'IBAN virtuel (structure funding_instructions)
        const bt: any = (fundingInstructions as any).bank_transfer;
        const financialAddresses = bt?.financial_addresses || bt?.eu_bank_transfer?.financial_addresses || [];
        const ibanEntry = Array.isArray(financialAddresses)
          ? financialAddresses.find((addr: any) => addr.type === 'iban' && addr.iban)
          : null;

        if (ibanEntry?.iban?.iban) {
          const ibanData = ibanEntry.iban;
          virtualIBAN = {
            iban: ibanData.iban,
            bic: ibanData.bic,
            account_holder_name: ibanData.account_holder_name,
            bank_name: ibanData.bank_address?.line1 ? `${ibanData.bank_address.line1}, ${ibanData.bank_address.city}` : undefined,
            country: ibanData.country || bt?.country,
          } as any;
          logger.log("✅ [CREATE-PAYMENT-V2] Virtual IBAN generated:", virtualIBAN.iban);
        } else {
          logger.error("❌ [CREATE-PAYMENT-V2] No IBAN in funding instructions response", { fundingInstructions: JSON.stringify(fundingInstructions) });
          return errorResponse("Stripe n’a pas retourné d’IBAN virtuel. Vérifiez Customer Balance et SEPA dans votre Dashboard Stripe.", 500);
        }
      } catch (error: any) {
        logger.error("❌ [CREATE-PAYMENT-V2] Error generating virtual IBAN:", {
          message: error?.message,
          type: error?.type,
          code: error?.code,
          statusCode: error?.statusCode,
          raw: JSON.stringify(error),
        });
        
        // Message d'erreur détaillé pour diagnostiquer
        const errorMsg = error?.message || String(error);
        if (errorMsg.includes('not enabled') || errorMsg.includes('Customer Balance')) {
          return errorResponse("Customer Balance is not enabled in your Stripe account. Please enable it in Stripe Dashboard → Settings → Customer Balance.", 500);
        }
        
        return errorResponse(`Failed to generate virtual IBAN: ${errorMsg}`, 500);
      }
    }

    /**
     * CREATE PAYMENT INTENT (avec escrow)
     * 
     * ✅ AMEX BLOCKED to protect RivvLock margins
     */
    const paymentIntentData: any = {
      amount: Math.round(transaction.price * 100), // Convert to cents
      currency: currency,
      capture_method: 'manual', // ESCROW: autorisation seulement
      description: `RIVVLOCK Escrow: ${transaction.title}`,
      metadata: {
        transaction_id: transactionId,
        transactionId: transactionId,
        seller_id: transaction.user_id,
        buyer_id: user!.id,
        service_date: transaction.service_date,
        platform: 'rivvlock',
        rivvlock_escrow: 'true',
        bank_transfer_available: hoursUntilDeadline >= 72 ? 'yes' : 'no',
        hours_until_deadline: Math.round(hoursUntilDeadline).toString(),
        payment_deadline: paymentDeadline.toISOString(),
        payment_method_requested: paymentMethod || 'card',
      },
      payment_method_types: paymentMethodTypes,
      // ✅ Block Amex to protect margins (fees too high: ~2.9% vs 1.4%)
      payment_method_options: {
        card: {
          request_three_d_secure: 'automatic',
          network_token: {
            request_network_token: true,
          },
        },
      },
      // ✅ Block Amex at the network level
      payment_method_data: {
        type: 'card',
      },
      customer: stripeCustomerId,
    };

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentData);
    logger.log("✅ [CREATE-PAYMENT-V2] Payment intent created:", paymentIntent.id);

    // Update transaction
    const { error: updateError } = await adminClient!
      .from("transactions")
      .update({ 
        stripe_payment_intent_id: paymentIntent.id,
        payment_method: paymentMethod || 'card'
      })
      .eq("id", transactionId);

    if (updateError) {
      logger.error("❌ [CREATE-PAYMENT-V2] Error updating transaction:", updateError);
      return errorResponse("Failed to update transaction", 500);
    }

    logger.log(`📧 [CREATE-PAYMENT-V2] Payment intent ready`);

    return successResponse({ 
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      virtualIBAN: virtualIBAN, // null si pas bank_transfer
      availablePaymentMethods: paymentMethodTypes,
    });
  } catch (error) {
    logger.error("❌ [CREATE-PAYMENT-V2] Error:", error);
    return errorResponse(error instanceof Error ? error.message : String(error), 500);
  }
};

const composedHandler = compose(
  withCors,
  withAuth,
  withRateLimit(),
  withValidation(schema)
)(handler);

Deno.serve(composedHandler);
