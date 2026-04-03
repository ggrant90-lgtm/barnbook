-- BarnBook Step 5 — profiles, barn fields, barn_members, keys, access (run in Supabase SQL Editor)
-- Requires existing public.horses, public.activity_log if you use those features.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  avatar_url text,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select to authenticated
  using (id = auth.uid());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert to authenticated
  with check (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- barns — add columns (safe if already present)
-- ---------------------------------------------------------------------------
alter table public.barns add column if not exists owner_id uuid references auth.users (id);
alter table public.barns add column if not exists address text;
alter table public.barns add column if not exists city text;
alter table public.barns add column if not exists state text;
alter table public.barns add column if not exists zip text;
alter table public.barns add column if not exists phone text;

-- ---------------------------------------------------------------------------
-- barn_members
-- ---------------------------------------------------------------------------
create table if not exists public.barn_members (
  id uuid primary key default gen_random_uuid(),
  barn_id uuid not null references public.barns (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  unique (barn_id, user_id)
);

create index if not exists barn_members_user_id_idx on public.barn_members (user_id);
create index if not exists barn_members_barn_id_idx on public.barn_members (barn_id);

alter table public.barn_members enable row level security;

drop policy if exists "barn_members_select_member" on public.barn_members;
create policy "barn_members_select_member"
  on public.barn_members for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "barn_members_insert_owner" on public.barn_members;
create policy "barn_members_insert_owner"
  on public.barn_members for insert to authenticated
  with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.barns b
      where b.id = barn_id and b.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- barns RLS (authenticated)
-- ---------------------------------------------------------------------------
alter table public.barns enable row level security;

drop policy if exists "barns_select_access" on public.barns;
create policy "barns_select_access"
  on public.barns for select to authenticated
  using (
    owner_id = auth.uid()
    or exists (
      select 1 from public.barn_members m
      where m.barn_id = barns.id and m.user_id = auth.uid()
    )
  );

drop policy if exists "barns_insert_owner" on public.barns;
create policy "barns_insert_owner"
  on public.barns for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "barns_update_owner" on public.barns;
create policy "barns_update_owner"
  on public.barns for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- barn_keys
-- ---------------------------------------------------------------------------
create table if not exists public.barn_keys (
  id uuid primary key default gen_random_uuid(),
  barn_id uuid not null references public.barns (id) on delete cascade,
  key_type text not null check (key_type in ('barn', 'stall')),
  horse_id uuid,
  label text,
  token_hash text not null,
  is_revoked boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create index if not exists barn_keys_barn_id_idx on public.barn_keys (barn_id);

alter table public.barn_keys enable row level security;

drop policy if exists "barn_keys_select" on public.barn_keys;
create policy "barn_keys_select"
  on public.barn_keys for select to authenticated
  using (
    exists (
      select 1 from public.barn_members m
      where m.barn_id = barn_keys.barn_id and m.user_id = auth.uid()
    )
    or exists (
      select 1 from public.barns b
      where b.id = barn_keys.barn_id and b.owner_id = auth.uid()
    )
  );

drop policy if exists "barn_keys_insert" on public.barn_keys;
create policy "barn_keys_insert"
  on public.barn_keys for insert to authenticated
  with check (
    exists (
      select 1 from public.barns b
      where b.id = barn_id and b.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.barn_members m
      where m.barn_id = barn_id and m.user_id = auth.uid() and m.role in ('owner', 'manager')
    )
  );

-- ---------------------------------------------------------------------------
-- barn_access_requests
-- ---------------------------------------------------------------------------
create table if not exists public.barn_access_requests (
  id uuid primary key default gen_random_uuid(),
  barn_id uuid not null references public.barns (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  created_at timestamptz not null default now(),
  unique (barn_id, user_id)
);

alter table public.barn_access_requests enable row level security;

drop policy if exists "bar_select" on public.barn_access_requests;
create policy "bar_select"
  on public.barn_access_requests for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.barns b
      where b.id = barn_id and b.owner_id = auth.uid()
    )
  );

drop policy if exists "bar_insert" on public.barn_access_requests;
create policy "bar_insert"
  on public.barn_access_requests for insert to authenticated
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- user_horse_access
-- ---------------------------------------------------------------------------
create table if not exists public.user_horse_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  horse_id uuid not null,
  source_key_id uuid references public.barn_keys (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, horse_id)
);

alter table public.user_horse_access enable row level security;

drop policy if exists "uha_select_own" on public.user_horse_access;
create policy "uha_select_own"
  on public.user_horse_access for select to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- horses / activity_log — optional RLS (skip if tables do not exist yet)
-- ---------------------------------------------------------------------------
-- Run the block below only after public.horses and public.activity_log exist.
/*
alter table public.horses enable row level security;
create policy "horses_select_barn" on public.horses for select to authenticated ...;
*/
