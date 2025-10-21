#!/bin/bash

# Script pour mettre à jour tous les edge functions vers Deno.serve()

# Liste des fichiers à corriger
files=(
  "supabase/functions/accept-proposal/index.ts"
  "supabase/functions/accept-quote/index.ts"
  "supabase/functions/admin-delete-transaction/index.ts"
  "supabase/functions/admin-dispute-actions/index.ts"
  "supabase/functions/admin-get-transaction/index.ts"
  "supabase/functions/attach-quote-to-user/index.ts"
  "supabase/functions/check-stripe-account-status/index.ts"
  "supabase/functions/clean-old-users/index.ts"
  "supabase/functions/confirm-transaction-date/index.ts"
  "supabase/functions/create-admin-proposal/index.ts"
  "supabase/functions/create-dispute/index.ts"
  "supabase/functions/create-payment-checkout/index.ts"
  "supabase/functions/create-payment-intent/index.ts"
  "supabase/functions/create-proposal/index.ts"
  "supabase/functions/create-stripe-account/index.ts"
  "supabase/functions/create-stripe-customer/index.ts"
  "supabase/functions/delete-expired-transaction/index.ts"
  "supabase/functions/delete-user-account/index.ts"
  "supabase/functions/ensure-transaction-conversation/index.ts"
  "supabase/functions/export-user-data/index.ts"
  "supabase/functions/finalize-admin-proposal/index.ts"
  "supabase/functions/fix-blocked-transaction/index.ts"
  "supabase/functions/fix-reactivated-transactions/index.ts"
  "supabase/functions/fix-resolved-disputes/index.ts"
  "supabase/functions/fix-transaction-refund/index.ts"
  "supabase/functions/force-escalate-dispute/index.ts"
  "supabase/functions/gdpr-data-retention-cleanup/index.ts"
  "supabase/functions/generate-annual-report/index.ts"
  "supabase/functions/generate-invoice-number/index.ts"
  "supabase/functions/get-invoice-data/index.ts"
  "supabase/functions/get-or-create-quote-conversation/index.ts"
  "supabase/functions/get-quote-by-token/index.ts"
  "supabase/functions/get-transaction-by-token/index.ts"
  "supabase/functions/get-transactions-enriched/index.ts"
  "supabase/functions/get-user-emails/index.ts"
  "supabase/functions/join-transaction/index.ts"
  "supabase/functions/mark-payment-authorized/index.ts"
  "supabase/functions/mark-quote-as-viewed/index.ts"
  "supabase/functions/process-automatic-transfer/index.ts"
  "supabase/functions/process-dispute-deadlines/index.ts"
  "supabase/functions/process-dispute/index.ts"
  "supabase/functions/process-expired-payment-deadlines/index.ts"
  "supabase/functions/process-validation-deadline/index.ts"
  "supabase/functions/refresh-counterparty-stripe-status/index.ts"
  "supabase/functions/reject-proposal/index.ts"
  "supabase/functions/release-funds/index.ts"
  "supabase/functions/renew-expired-transaction/index.ts"
  "supabase/functions/request-date-change/index.ts"
  "supabase/functions/resend-quote-email/index.ts"
  "supabase/functions/respond-to-date-change/index.ts"
  "supabase/functions/respond-to-dispute/index.ts"
  "supabase/functions/send-email/index.ts"
  "supabase/functions/send-notifications/index.ts"
  "supabase/functions/send-payment-reminders/index.ts"
  "supabase/functions/send-validation-reminders/index.ts"
  "supabase/functions/stripe-webhook/index.ts"
  "supabase/functions/sync-stripe-customers/index.ts"
  "supabase/functions/sync-stripe-payments/index.ts"
  "supabase/functions/update-quote/index.ts"
  "supabase/functions/update-stripe-account-info/index.ts"
  "supabase/functions/validate-admin-proposal/index.ts"
  "supabase/functions/validate-stripe-accounts/index.ts"
)

echo "🔧 Mise à jour de ${#files[@]} edge functions vers Deno.serve()..."

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    # Supprimer l'import serve
    sed -i.bak '/^import.*serve.*from.*deno\.land\/std@/d' "$file"
    
    # Remplacer serve( par Deno.serve(
    sed -i.bak 's/serve(/Deno.serve(/g' "$file"
    
    # Supprimer les fichiers backup
    rm -f "${file}.bak"
    
    echo "✅ $file"
  else
    echo "⚠️  $file not found"
  fi
done

echo "✨ Terminé ! Tous les edge functions ont été mis à jour."
