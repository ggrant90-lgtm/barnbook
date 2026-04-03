/*
  Table for per-pose biometric embeddings + optional enrollment photo URLs.
  Run in Supabase SQL Editor after public.horses exists.

  Then add RLS (see bottom) or merge policies from your rls-anon-barn.sql pattern.
*/

create table if not exists public.horse_biometric_embeddings (
  horse_id uuid not null references public.horses (id) on delete cascade,
  pose_key text not null,
  embedding jsonb not null,
  photo_url text,
  updated_at timestamptz not null default now(),
  primary key (horse_id, pose_key)
);

create index if not exists horse_biometric_embeddings_horse_id_idx
  on public.horse_biometric_embeddings (horse_id);

alter table public.horse_biometric_embeddings enable row level security;

-- Anon client (same barn as app CURRENT_BARN_ID)
drop policy if exists "equi_anon_select_biometric" on public.horse_biometric_embeddings;
create policy "equi_anon_select_biometric"
  on public.horse_biometric_embeddings
  for select
  to anon
  using (
    exists (
      select 1
      from public.horses h
      where h.id = horse_biometric_embeddings.horse_id
        and h.barn_id = '0ea8f75c-377c-4077-8202-233a23a5ef9b'
    )
  );

drop policy if exists "equi_anon_insert_biometric" on public.horse_biometric_embeddings;
create policy "equi_anon_insert_biometric"
  on public.horse_biometric_embeddings
  for insert
  to anon
  with check (
    exists (
      select 1
      from public.horses h
      where h.id = horse_biometric_embeddings.horse_id
        and h.barn_id = '0ea8f75c-377c-4077-8202-233a23a5ef9b'
    )
  );

drop policy if exists "equi_anon_update_biometric" on public.horse_biometric_embeddings;
create policy "equi_anon_update_biometric"
  on public.horse_biometric_embeddings
  for update
  to anon
  using (
    exists (
      select 1
      from public.horses h
      where h.id = horse_biometric_embeddings.horse_id
        and h.barn_id = '0ea8f75c-377c-4077-8202-233a23a5ef9b'
    )
  )
  with check (
    exists (
      select 1
      from public.horses h
      where h.id = horse_biometric_embeddings.horse_id
        and h.barn_id = '0ea8f75c-377c-4077-8202-233a23a5ef9b'
    )
  );
