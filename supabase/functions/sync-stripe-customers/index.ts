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
    console.log("Starting Stripe customer sync for existing profiles...");

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2024-06-20",
    });

    // Get all profiles without stripe_customer_id
    const { data: profiles, error: profilesError } = await supabaseClient
      .from("profiles")
      .select(`
        user_id,
        first_name,
        last_name,
        phone,
        address,
        company_name,
        country,
        stripe_customer_id
      `)
      .is("stripe_customer_id", null);

    if (profilesError) {
      throw new Error(`Failed to fetch profiles: ${profilesError.message}`);
    }

    console.log(`Found ${profiles?.length || 0} profiles without Stripe customers`);

    let created = 0;
    let errors = 0;

    if (profiles && profiles.length > 0) {
      // Get user emails from auth.users
      for (const profile of profiles) {
        try {
          // Get user data
          const { data: userData, error: userError } = await supabaseClient.auth.admin.getUserById(profile.user_id);
          
          if (userError || !userData.user?.email) {
            console.error(`No email found for user ${profile.user_id}:`, userError);
            errors++;
            continue;
          }

          const email = userData.user.email;

          // Check if customer already exists in Stripe
          const existingCustomers = await stripe.customers.list({ 
            email: email, 
            limit: 1 
          });

          let customerId;

          if (existingCustomers.data.length > 0) {
            // Use existing customer
            customerId = existingCustomers.data[0].id;
            console.log(`Using existing Stripe customer ${customerId} for ${email}`);
          } else {
            // Create new customer
            const customerData: any = {
              email: email,
              metadata: {
                user_id: profile.user_id,
                source: 'rivvlock_sync'
              }
            };

            // Add name
            if (profile.first_name || profile.last_name) {
              customerData.name = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
            }

            // Add company name if available
            if (profile.company_name) {
              customerData.name = profile.company_name;
              customerData.description = `Company: ${profile.company_name}`;
            }

            // Add phone if available
            if (profile.phone) {
              customerData.phone = profile.phone;
            }

            // Add address if available
            if (profile.address) {
              customerData.address = {
                line1: profile.address,
                country: profile.country === 'CH' ? 'CH' : 'FR'
              };
            }

            const customer = await stripe.customers.create(customerData);
            customerId = customer.id;
            console.log(`Created new Stripe customer ${customerId} for ${email}`);
          }

          // Update profile with stripe_customer_id
          const { error: updateError } = await supabaseClient
            .from("profiles")
            .update({ stripe_customer_id: customerId })
            .eq("user_id", profile.user_id);

          if (updateError) {
            console.error(`Failed to update profile ${profile.user_id}:`, updateError);
            errors++;
          } else {
            created++;
            console.log(`Updated profile ${profile.user_id} with customer ${customerId}`);
          }

        } catch (error) {
          console.error(`Error processing profile ${profile.user_id}:`, error);
          errors++;
        }
      }
    }

    console.log(`Sync completed: ${created} customers synced, ${errors} errors`);

    return new Response(JSON.stringify({ 
      success: true,
      synced: created,
      errors: errors,
      total_profiles: profiles?.length || 0
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Error syncing Stripe customers:", error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});