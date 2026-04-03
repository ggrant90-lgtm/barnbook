-- BarnBook Step 6 — horse management columns + storage (run after core tables exist)

alter table public.horses add column if not exists created_by uuid references auth.users (id);

alter table public.activity_log add column if not exists details jsonb;

alter table public.health_records add column if not exists details jsonb;

-- Optional: relax NOT NULL on activity_log.duration_minutes if your DB has strict NOT NULL — app sends 0 when unused
-- alter table public.activity_log alter column duration_minutes drop not null;

comment on column public.activity_log.details is 'Structured fields for exercise, feed, medication, note (type-specific JSON)';
comment on column public.health_records.details is 'Structured fields for shoeing, worming, vet_visit (type-specific JSON)';
