import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Admin client for database operations
  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    console.log("📬 [SEND-VALIDATION-REMINDERS] Starting reminder processing");

    const now = new Date();
    
    // Define reminder times (hours before deadline)
    const reminderTypes = [
      { type: '24h', hours: 24 },
      { type: '12h', hours: 12 },
      { type: '6h', hours: 6 },
      { type: '1h', hours: 1 }
    ];

    let totalSent = 0;

    for (const reminder of reminderTypes) {
      // Calculate the time window for this reminder type
      const reminderTime = new Date();
      reminderTime.setHours(reminderTime.getHours() + reminder.hours);
      
      // Find transactions that need this reminder (within 1 hour window)
      const windowStart = new Date(reminderTime);
      windowStart.setMinutes(windowStart.getMinutes() - 30);
      const windowEnd = new Date(reminderTime);
      windowEnd.setMinutes(windowEnd.getMinutes() + 30);

      console.log(`🔍 [SEND-VALIDATION-REMINDERS] Checking ${reminder.type} reminders for window: ${windowStart.toISOString()} to ${windowEnd.toISOString()}`);

      // Find transactions that need this reminder
      // Only process transactions that have an active validation deadline
      const { data: transactions, error: fetchError } = await adminClient
        .from("transactions")
        .select("*")
        .eq("seller_validated", true)
        .eq("buyer_validated", false)
        .eq("funds_released", false)
        .eq("status", "paid")
        .not("validation_deadline", "is", null)
        .gte("validation_deadline", windowStart.toISOString())
        .lte("validation_deadline", windowEnd.toISOString());

      if (fetchError) {
        console.error(`❌ [SEND-VALIDATION-REMINDERS] Error fetching transactions for ${reminder.type}:`, fetchError);
        continue;
      }

      if (!transactions || transactions.length === 0) {
        console.log(`ℹ️ [SEND-VALIDATION-REMINDERS] No transactions found for ${reminder.type} reminder`);
        continue;
      }

      console.log(`📋 [SEND-VALIDATION-REMINDERS] Found ${transactions.length} transactions for ${reminder.type} reminder`);

      // Process each transaction
      for (const transaction of transactions) {
        try {
          // Check if reminder already sent
          const { data: existingReminder, error: checkError } = await adminClient
            .from("validation_reminders")
            .select("id")
            .eq("transaction_id", transaction.id)
            .eq("reminder_type", reminder.type)
            .maybeSingle();

          if (checkError) {
            console.error(`❌ [SEND-VALIDATION-REMINDERS] Error checking existing reminder:`, checkError);
            continue;
          }

          if (existingReminder) {
            console.log(`⏭️ [SEND-VALIDATION-REMINDERS] Reminder ${reminder.type} already sent for transaction ${transaction.id}`);
            continue;
          }

          // Create reminder messages based on type
          let message = "";
          switch (reminder.type) {
            case '24h':
              message = `⏰ Rappel : Il vous reste 24 heures pour valider la libération des fonds pour la transaction "${transaction.title}". Montant : ${transaction.price} ${transaction.currency}.`;
              break;
            case '12h':
              message = `⚠️ Attention : Il vous reste 12 heures pour valider la libération des fonds pour la transaction "${transaction.title}". Après expiration, les fonds seront libérés automatiquement.`;
              break;
            case '6h':
              message = `🚨 Urgent : Il vous reste 6 heures pour valider la libération des fonds pour la transaction "${transaction.title}". Libération automatique imminente.`;
              break;
            case '1h':
              message = `⏰ Dernière chance : Il vous reste 1 heure pour valider la libération des fonds pour la transaction "${transaction.title}". Libération automatique dans 1 heure.`;
              break;
          }

          // Send notification to buyer
          await adminClient.functions.invoke('send-notifications', {
            body: {
              type: 'validation_reminder',
              transactionId: transaction.id,
              message: message,
              recipients: [transaction.buyer_id].filter(Boolean)
            }
          });

          // Record that reminder was sent
          const { error: insertError } = await adminClient
            .from("validation_reminders")
            .insert({
              transaction_id: transaction.id,
              reminder_type: reminder.type
            });

          if (insertError) {
            console.error(`❌ [SEND-VALIDATION-REMINDERS] Error recording reminder:`, insertError);
            continue;
          }

          console.log(`✅ [SEND-VALIDATION-REMINDERS] Sent ${reminder.type} reminder for transaction ${transaction.id}`);
          totalSent++;

        } catch (error) {
          console.error(`❌ [SEND-VALIDATION-REMINDERS] Error processing transaction ${transaction.id}:`, error);
        }
      }
    }

    console.log(`🏁 [SEND-VALIDATION-REMINDERS] Processing complete. Total reminders sent: ${totalSent}`);

    return new Response(JSON.stringify({ 
      success: true,
      remindersSent: totalSent
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("❌ [SEND-VALIDATION-REMINDERS] Function error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});