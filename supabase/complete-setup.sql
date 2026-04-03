/*
  ============================================================================
  Equi-Track — ONE-SHOT SUPABASE SETUP (policies + biometric table + identify)
  ============================================================================

  I cannot run this for you — paste the ENTIRE file into:
    Supabase Dashboard → SQL Editor → New query → Run

  BEFORE YOU RUN:
  • Tables must already exist: public.barns, public.horses, public.activity_log,
    public.health_records (your existing schema).
  • UUID below MUST match lib/constants.ts → CURRENT_BARN_ID and your barn row.
    If your barn id differs, find/replace this id in THIS file only:
      0ea8f75c-377c-4077-8202-233a23a5ef9b

  AFTER YOU RUN (manual, 30 seconds):
  • Storage → ensure bucket "horse-photos" exists and is Public.
    If this script’s bucket insert fails, create the bucket in the UI instead.

  ============================================================================
*/

-- Optional: public bucket for horse photos (safe to re-run)
insert into storage.buckets (id, name, public)
values ('horse-photos', 'horse-photos', true)
on conflict (id) do update set public = excluded.public;

-- =============================================================================
-- A) Biometric embeddings table + barn-scoped RLS
-- =============================================================================

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

-- =============================================================================
-- B) Core app RLS (barn, horses, logs, health, storage.objects)
-- =============================================================================

drop policy if exists "equi_anon_select_barn" on public.barns;
create policy "equi_anon_select_barn"
  on public.barns
  for select
  to anon
  using (id = '0ea8f75c-377c-4077-8202-233a23a5ef9b');

drop policy if exists "equi_anon_select_horses" on public.horses;
create policy "equi_anon_select_horses"
  on public.horses
  for select
  to anon
  using (barn_id = '0ea8f75c-377c-4077-8202-233a23a5ef9b');

drop policy if exists "equi_anon_insert_horses" on public.horses;
create policy "equi_anon_insert_horses"
  on public.horses
  for insert
  to anon
  with check (barn_id = '0ea8f75c-377c-4077-8202-233a23a5ef9b');

drop policy if exists "equi_anon_update_horses" on public.horses;
create policy "equi_anon_update_horses"
  on public.horses
  for update
  to anon
  using (barn_id = '0ea8f75c-377c-4077-8202-233a23a5ef9b')
  with check (barn_id = '0ea8f75c-377c-4077-8202-233a23a5ef9b');

drop policy if exists "equi_anon_select_activity_log" on public.activity_log;
create policy "equi_anon_select_activity_log"
  on public.activity_log
  for select
  to anon
  using (
    exists (
      select 1
      from public.horses h
      where h.id = activity_log.horse_id
        and h.barn_id = '0ea8f75c-377c-4077-8202-233a23a5ef9b'
    )
  );

drop policy if exists "equi_anon_insert_activity_log" on public.activity_log;
create policy "equi_anon_insert_activity_log"
  on public.activity_log
  for insert
  to anon
  with check (
    exists (
      select 1
      from public.horses h
      where h.id = activity_log.horse_id
        and h.barn_id = '0ea8f75c-377c-4077-8202-233a23a5ef9b'
    )
  );

drop policy if exists "equi_anon_select_health_records" on public.health_records;
create policy "equi_anon_select_health_records"
  on public.health_records
  for select
  to anon
  using (
    exists (
      select 1
      from public.horses h
      where h.id = health_records.horse_id
        and h.barn_id = '0ea8f75c-377c-4077-8202-233a23a5ef9b'
    )
  );

drop policy if exists "equi_anon_insert_health_records" on public.health_records;
create policy "equi_anon_insert_health_records"
  on public.health_records
  for insert
  to anon
  with check (
    exists (
      select 1
      from public.horses h
      where h.id = health_records.horse_id
        and h.barn_id = '0ea8f75c-377c-4077-8202-233a23a5ef9b'
    )
  );

drop policy if exists "equi_anon_select_horse_photos" on storage.objects;
create policy "equi_anon_select_horse_photos"
  on storage.objects
  for select
  to anon
  using (bucket_id = 'horse-photos');

drop policy if exists "equi_anon_insert_horse_photos" on storage.objects;
create policy "equi_anon_insert_horse_photos"
  on storage.objects
  for insert
  to anon
  with check (bucket_id = 'horse-photos');

drop policy if exists "equi_anon_update_horse_photos" on storage.objects;
create policy "equi_anon_update_horse_photos"
  on storage.objects
  for update
  to anon
  using (bucket_id = 'horse-photos')
  with check (bucket_id = 'horse-photos');

drop policy if exists "equi_anon_delete_horse_photos" on storage.objects;
create policy "equi_anon_delete_horse_photos"
  on storage.objects
  for delete
  to anon
  using (bucket_id = 'horse-photos');

-- =============================================================================
-- C) Global read for “Identify horse” (all barns)
-- =============================================================================

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
