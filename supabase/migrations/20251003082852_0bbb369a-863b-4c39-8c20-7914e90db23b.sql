-- Créer une nouvelle fonction helper sans toucher à is_admin existant
create or replace function public.check_admin_role(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 
    from public.admin_roles ar 
    where ar.user_id = _user_id 
    and ar.role = 'admin'
  );
$$;

-- Supprimer toutes les policies SELECT existantes sur transaction_access_attempts
do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public'
      and tablename = 'transaction_access_attempts'
      and cmd = 'SELECT'
  loop
    execute format('drop policy if exists %I on public.transaction_access_attempts', pol.policyname);
  end loop;
end $$;

-- Créer une seule policy stricte : admin-only
create policy "Only admins can select access attempts"
on public.transaction_access_attempts
for select
to authenticated
using (public.check_admin_role(auth.uid()));

comment on table public.transaction_access_attempts is 
  'Security-sensitive table containing failed login attempts and tokens. Only accessible by admins.';
