import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { 
  compose, 
  withCors, 
  withRateLimit, 
  withValidation,
  successResponse, 
  errorResponse,
  Handler, 
  HandlerContext 
} from "../_shared/middleware.ts";
import { createServiceClient } from "../_shared/supabase-utils.ts";
import { logger } from "../_shared/logger.ts";

const createStripeCustomerSchema = z.object({
  user_id: z.string().uuid(),
  email: z.string().email(),
  profile_data: z.object({
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    company_name: z.string().optional(),
    user_type: z.string().optional(),
    country: z.string().optional(),
    phone: z.string().optional(),
    address: z.string().optional()
  }).optional()
});

const handler: Handler = async (req, ctx: HandlerContext) => {
  const { body } = ctx;
  const { user_id, email, profile_data } = body;
  
  const supabaseClient = createServiceClient();
  
  try {
    logger.log("Creating Stripe customer for user:", user_id, email);

    // Check if profile already has a Stripe customer ID to avoid duplicates
    const { data: existingProfile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('stripe_customer_id')
      .eq('user_id', user_id)
      .single();

    if (profileError) {
      logger.error('Error checking existing profile:', profileError);
    } else if (existingProfile?.stripe_customer_id) {
      logger.log(`User ${user_id} already has Stripe customer ID:`, existingProfile.stripe_customer_id);
      return successResponse({ 
        stripe_customer_id: existingProfile.stripe_customer_id,
        message: "Customer already exists"
      });
    }

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2024-06-20",
    });

    // Check if customer already exists in Stripe
    const existingCustomers = await stripe.customers.list({
      email: email,
      limit: 1
    });

    let stripeCustomerId;
    
    if (existingCustomers.data.length > 0) {
      stripeCustomerId = existingCustomers.data[0].id;
      logger.log(`Found existing Stripe customer: ${stripeCustomerId}`);
    } else {
      // Prepare customer data
      const customerData: any = {
        email: email,
        metadata: {
          user_id: user_id,
          source: 'rivvlock',
          user_type: profile_data?.user_type || 'individual',
          country: profile_data?.country || 'FR'
        }
      };

      // Add name if available
      if (profile_data?.first_name || profile_data?.last_name) {
        customerData.name = `${profile_data.first_name || ''} ${profile_data.last_name || ''}`.trim();
      }

      // Add company name if available
      if (profile_data?.company_name) {
        customerData.name = profile_data.company_name;
        customerData.description = `Company: ${profile_data.company_name}`;
      }

      // Add phone if available
      if (profile_data?.phone) {
        customerData.phone = profile_data.phone;
      }

      // Add address if available
      if (profile_data?.address) {
        customerData.address = {
          line1: profile_data.address,
          country: profile_data.country === 'CH' ? 'CH' : 'FR'
        };
      }

      // Create Stripe customer
      const customer = await stripe.customers.create(customerData);
      stripeCustomerId = customer.id;
      logger.log("Stripe customer created:", stripeCustomerId);
    }

    // Update profile with stripe_customer_id
    const { error: updateError } = await supabaseClient
      .from("profiles")
      .update({ stripe_customer_id: stripeCustomerId })
      .eq("user_id", user_id);

    if (updateError) {
      logger.error("Error updating profile with Stripe customer ID:", updateError);
      throw new Error("Failed to update profile");
    }

    logger.log("Profile updated with Stripe customer ID:", stripeCustomerId);

    return successResponse({ stripe_customer_id: stripeCustomerId });

  } catch (error) {
    logger.error("Error creating Stripe customer:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return errorResponse(errorMessage, 500);
  }
};

const composedHandler = compose(
  withCors,
  withRateLimit(),
  withValidation(createStripeCustomerSchema)
)(handler);

serve(composedHandler);