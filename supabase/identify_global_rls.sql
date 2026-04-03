/*
  Allow anonymous clients to READ all biometric embeddings and all horses
  for the "Identify horse" flow (probe photo vs entire database).

  PostgreSQL ORs multiple SELECT policies — this adds global read alongside
  existing barn-scoped policies.

  Security: anyone with your anon key can list embeddings and horse names
  across barns. Tighten later with Supabase Auth + Edge Functions if needed.
*/

drop policy if exists "equi_anon_select_embeddings_global_identify"
  on public.horse_biometric_embeddings;

create policy "equi_anon_select_embeddings_global_identify"
  on public.horse_biometric_embeddings
  for select
  to anon
  using (true);

drop policy if exists "equi_anon_select_horses_global_identify"
  on public.horses;

create policy "equi_anon_select_horses_global_identify"
  on public.horses
  for select
  to anon
  using (true);
