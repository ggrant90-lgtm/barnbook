-- BarnBook Step 7 — access_keys (rename from barn_keys), key_redemptions, key_requests, redeem RPC
-- Run after step5 (and horses exist for stall keys).

-- ---------------------------------------------------------------------------
-- Rename barn_keys → access_keys
-- ---------------------------------------------------------------------------
drop policy if exists "barn_keys_select" on public.barn_keys;
drop policy if exists "barn_keys_insert" on public.barn_keys;

alter table public.barn_keys rename to access_keys;

alter index if exists barn_keys_barn_id_idx rename to access_keys_barn_id_idx;

alter table public.access_keys alter column token_hash drop not null;

alter table public.access_keys
  add column if not exists key_code text,
  add column if not exists permission_level text not null default 'viewer'
    check (permission_level in ('viewer', 'editor')),
  add column if not exists max_uses int,
  add column if not exists times_used int not null default 0,
  add column if not exists is_active boolean not null default true;

-- Legacy rows: synthetic codes (rotate in UI if needed)
update public.access_keys
set key_code = 'BK-MIGR-' || replace(id::text, '-', '')
where key_code is null;

update public.access_keys
set token_hash = encode(sha256(convert_to(key_code, 'UTF8')), 'hex')
where token_hash is null;

alter table public.access_keys alter column key_code set not null;

create unique index if not exists access_keys_key_code_unique on public.access_keys (key_code);

-- is_revoked → is_active (invert once), then drop legacy column
do $$
begin
  if exists (
    select 1 from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'access_keys' and c.column_name = 'is_revoked'
  ) then
    update public.access_keys set is_active = not coalesce(is_revoked, false);
    alter table public.access_keys drop column is_revoked;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- key_redemptions
-- ---------------------------------------------------------------------------
create table if not exists public.key_redemptions (
  id uuid primary key default gen_random_uuid(),
  access_key_id uuid not null references public.access_keys (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  unique (access_key_id, user_id)
);

create index if not exists key_redemptions_user_id_idx on public.key_redemptions (user_id);

alter table public.key_redemptions enable row level security;

drop policy if exists "key_redemptions_select_own" on public.key_redemptions;
create policy "key_redemptions_select_own"
  on public.key_redemptions for select to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- key_requests (pending access asks; owners/managers approve in app)
-- ---------------------------------------------------------------------------
create table if not exists public.key_requests (
  id uuid primary key default gen_random_uuid(),
  barn_id uuid not null references public.barns (id) on delete cascade,
  requester_id uuid not null references auth.users (id) on delete cascade,
  full_name text,
  email text,
  desired_role text not null default 'viewer',
  message text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  created_at timestamptz not null default now()
);

create index if not exists key_requests_barn_id_idx on public.key_requests (barn_id);
create index if not exists key_requests_status_idx on public.key_requests (barn_id, status);

alter table public.key_requests enable row level security;

drop policy if exists "key_requests_select" on public.key_requests;
create policy "key_requests_select"
  on public.key_requests for select to authenticated
  using (
    requester_id = auth.uid()
    or exists (
      select 1 from public.barns b
      where b.id = barn_id and b.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.barn_members m
      where m.barn_id = key_requests.barn_id and m.user_id = auth.uid()
        and m.role in ('owner', 'manager')
    )
  );

drop policy if exists "key_requests_insert" on public.key_requests;
create policy "key_requests_insert"
  on public.key_requests for insert to authenticated
  with check (requester_id = auth.uid());

drop policy if exists "key_requests_update_managers" on public.key_requests;
create policy "key_requests_update_managers"
  on public.key_requests for update to authenticated
  using (
    exists (
      select 1 from public.barns b
      where b.id = barn_id and b.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.barn_members m
      where m.barn_id = key_requests.barn_id and m.user_id = auth.uid()
        and m.role in ('owner', 'manager')
    )
  );

-- ---------------------------------------------------------------------------
-- RLS access_keys (replace old policies)
-- ---------------------------------------------------------------------------
drop policy if exists "access_keys_select" on public.access_keys;
create policy "access_keys_select"
  on public.access_keys for select to authenticated
  using (
    exists (
      select 1 from public.barn_members m
      where m.barn_id = access_keys.barn_id and m.user_id = auth.uid()
    )
    or exists (
      select 1 from public.barns b
      where b.id = access_keys.barn_id and b.owner_id = auth.uid()
    )
  );

drop policy if exists "access_keys_insert" on public.access_keys;
create policy "access_keys_insert"
  on public.access_keys for insert to authenticated
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

drop policy if exists "access_keys_update" on public.access_keys;
create policy "access_keys_update"
  on public.access_keys for update to authenticated
  using (
    exists (
      select 1 from public.barns b
      where b.id = barn_id and b.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.barn_members m
      where m.barn_id = access_keys.barn_id and m.user_id = auth.uid() and m.role in ('owner', 'manager')
    )
  );

drop policy if exists "access_keys_delete" on public.access_keys;
create policy "access_keys_delete"
  on public.access_keys for delete to authenticated
  using (
    exists (
      select 1 from public.barns b
      where b.id = barn_id and b.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.barn_members m
      where m.barn_id = access_keys.barn_id and m.user_id = auth.uid() and m.role in ('owner', 'manager')
    )
  );

-- ---------------------------------------------------------------------------
-- redeem_access_key — lookup by normalized code; SECURITY DEFINER
-- ---------------------------------------------------------------------------
create or replace function public.redeem_access_key(p_raw_code text, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key public.access_keys%rowtype;
  v_norm text;
  v_cmp text;
  v_role text;
begin
  if p_user_id is null or p_raw_code is null or length(trim(p_raw_code)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_key');
  end if;

  v_norm := upper(regexp_replace(trim(p_raw_code), '\s+', '', 'g'));
  v_cmp := regexp_replace(v_norm, '-', '', 'g');

  select * into v_key
  from public.access_keys
  where regexp_replace(upper(regexp_replace(trim(key_code), '\s+', '', 'g')), '-', '', 'g') = v_cmp
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_key');
  end if;

  if exists (
    select 1 from public.key_redemptions r
    where r.access_key_id = v_key.id and r.user_id = p_user_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'already_redeemed');
  end if;

  if not v_key.is_active then
    return jsonb_build_object('ok', false, 'error', 'inactive');
  end if;

  if v_key.expires_at is not null and v_key.expires_at < now() then
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  if v_key.max_uses is not null and v_key.times_used >= v_key.max_uses then
    return jsonb_build_object('ok', false, 'error', 'max_uses');
  end if;

  insert into public.key_redemptions (access_key_id, user_id)
  values (v_key.id, p_user_id);

  update public.access_keys
  set times_used = times_used + 1
  where id = v_key.id;

  v_role := case when v_key.permission_level = 'editor' then 'editor' else 'member' end;

  if v_key.key_type = 'barn' then
    insert into public.barn_members (barn_id, user_id, role)
    values (v_key.barn_id, p_user_id, v_role)
    on conflict (barn_id, user_id) do update set
      role = case
        when public.barn_members.role in ('owner', 'manager') then public.barn_members.role
        when excluded.role = 'editor' then 'editor'
        else public.barn_members.role
      end;
  elsif v_key.key_type = 'stall' and v_key.horse_id is not null then
    insert into public.user_horse_access (user_id, horse_id, source_key_id)
    values (p_user_id, v_key.horse_id, v_key.id)
    on conflict (user_id, horse_id) do nothing;
  end if;

  return jsonb_build_object(
    'ok', true,
    'key_type', v_key.key_type,
    'barn_id', v_key.barn_id,
    'horse_id', v_key.horse_id
  );
end;
$$;

revoke all on function public.redeem_access_key(text, uuid) from public;
grant execute on function public.redeem_access_key(text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Managers may add barn members (approve key requests from UI)
-- ---------------------------------------------------------------------------
drop policy if exists "barn_members_insert_owner" on public.barn_members;
create policy "barn_members_insert_owner"
  on public.barn_members for insert to authenticated
  with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.barns b
      where b.id = barn_id and b.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.barn_members m
      where m.barn_id = barn_id and m.user_id = auth.uid() and m.role in ('owner', 'manager')
    )
  );
