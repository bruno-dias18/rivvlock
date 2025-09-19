import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const { user_id, email, profile_data } = await req.json();
    
    console.log("Creating Stripe customer for user:", user_id, email);

    // Check if profile already has a Stripe customer ID to avoid duplicates
    const { data: existingProfile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('stripe_customer_id')
      .eq('user_id', user_id)
      .single();

    if (profileError) {
      console.error('Error checking existing profile:', profileError);
    } else if (existingProfile?.stripe_customer_id) {
      console.log(`User ${user_id} already has Stripe customer ID:`, existingProfile.stripe_customer_id);
      return new Response(JSON.stringify({ 
        success: true,
        stripe_customer_id: existingProfile.stripe_customer_id,
        message: "Customer already exists"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Check if customer already exists in Stripe
    const existingCustomers = await stripe.customers.list({
      email: email,
      limit: 1
    });

    let stripeCustomerId;
    
    if (existingCustomers.data.length > 0) {
      stripeCustomerId = existingCustomers.data[0].id;
      console.log(`Found existing Stripe customer: ${stripeCustomerId}`);
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
      console.log("Stripe customer created:", stripeCustomerId);
    }

    // Update profile with stripe_customer_id
    const { error: updateError } = await supabaseClient
      .from("profiles")
      .update({ stripe_customer_id: stripeCustomerId })
      .eq("user_id", user_id);

    if (updateError) {
      console.error("Error updating profile with Stripe customer ID:", updateError);
      throw new Error("Failed to update profile");
    }

    console.log("Profile updated with Stripe customer ID:", stripeCustomerId);

    return new Response(JSON.stringify({ 
      success: true,
      stripe_customer_id: stripeCustomerId 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Error creating Stripe customer:", error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});