-- Améliorer la fonction get_counterparty_stripe_status avec logging et retour explicite
create or replace function public.get_counterparty_stripe_status(stripe_user_id uuid)
returns table(has_active_account boolean, charges_enabled boolean, payouts_enabled boolean, onboarding_completed boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_is_counterparty boolean;
  v_auth_uid uuid;
begin
  v_auth_uid := auth.uid();
  
  -- Log l'appel pour debugging
  raise notice 'get_counterparty_stripe_status called: auth_uid=%, stripe_user_id=%', v_auth_uid, stripe_user_id;
  
  -- Vérifier que l'utilisateur est autorisé (transaction counterparty)
  v_is_counterparty := are_transaction_counterparties(v_auth_uid, stripe_user_id);
  
  raise notice 'are_transaction_counterparties result: %', v_is_counterparty;
  
  if not v_is_counterparty then
    raise notice 'User % is NOT a counterparty of %', v_auth_uid, stripe_user_id;
    -- Retourner explicitement false au lieu de retourner vide
    return query select false, false, false, false;
    return;
  end if;

  -- Logger l'accès pour audit
  insert into public.profile_access_logs (
    accessed_profile_id,
    accessed_by_user_id,
    access_type,
    accessed_fields
  ) values (
    stripe_user_id,
    v_auth_uid,
    'stripe_status_view',
    array['charges_enabled', 'payouts_enabled', 'onboarding_completed']
  );

  -- Retourner uniquement les informations non-sensibles
  return query
  select 
    (sa.charges_enabled and sa.payouts_enabled and sa.onboarding_completed) as has_active_account,
    sa.charges_enabled,
    sa.payouts_enabled,
    sa.onboarding_completed
  from public.stripe_accounts sa
  where sa.user_id = stripe_user_id
  and sa.account_status != 'inactive'
  limit 1;
  
  -- Si aucun compte trouvé, retourner explicitement false
  if not found then
    raise notice 'No active stripe account found for user %', stripe_user_id;
    return query select false, false, false, false;
  end if;
end;
$$;