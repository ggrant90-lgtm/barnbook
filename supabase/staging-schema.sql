-- ============================================================
-- BarnBook Staging Schema
-- Generated from production on 2026-04-08
-- Run this in the staging Supabase SQL Editor
-- ============================================================

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  phone text,
  role text DEFAULT 'owner'::text,
  avatar_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  is_platform_admin boolean DEFAULT false NOT NULL
);

CREATE TABLE IF NOT EXISTS public.barns (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  name text NOT NULL,
  owner_id uuid NOT NULL REFERENCES auth.users(id),
  address text,
  city text,
  state text,
  zip text,
  phone text,
  logo_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  banner_url text,
  about text,
  website text,
  instagram text,
  facebook text,
  public_email text,
  public_phone text,
  barn_type text DEFAULT 'standard'::text NOT NULL,
  plan_tier text DEFAULT 'free'::text NOT NULL,
  stall_capacity integer DEFAULT 999 NOT NULL,
  plan_started_at timestamp with time zone,
  plan_expires_at timestamp with time zone,
  plan_notes text,
  plan_updated_by_user_id uuid,
  plan_updated_at timestamp with time zone,
  grace_period_ends_at timestamp with time zone,
  default_payment_instructions text,
  next_invoice_number integer DEFAULT 1 NOT NULL
);

CREATE TABLE IF NOT EXISTS public.barn_members (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  barn_id uuid NOT NULL REFERENCES public.barns(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text DEFAULT 'viewer'::text NOT NULL,
  invited_by uuid,
  joined_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  status text DEFAULT 'active'::text NOT NULL,
  UNIQUE (barn_id, user_id)
);

CREATE INDEX IF NOT EXISTS barn_members_user_id_idx ON public.barn_members(user_id);
CREATE INDEX IF NOT EXISTS barn_members_barn_id_idx ON public.barn_members(barn_id);

CREATE TABLE IF NOT EXISTS public.horses (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  barn_id uuid NOT NULL REFERENCES public.barns(id) ON DELETE CASCADE,
  name text NOT NULL,
  barn_name text,
  breed text,
  sex text,
  color text,
  foal_date date,
  sire text,
  dam text,
  registration_number text,
  microchip_number text,
  photo_url text,
  status text DEFAULT 'active'::text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  qr_code text,
  feed_regimen text,
  supplements text,
  special_care_notes text,
  turnout_schedule text,
  archived boolean DEFAULT false NOT NULL,
  owner_name text
);

CREATE TABLE IF NOT EXISTS public.activity_log (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  horse_id uuid REFERENCES public.horses(id) ON DELETE CASCADE,
  barn_id uuid REFERENCES public.barns(id),
  logged_by uuid REFERENCES auth.users(id),
  activity_type text,
  title text,
  notes text,
  data jsonb DEFAULT '{}'::jsonb,
  activity_date date DEFAULT CURRENT_DATE,
  created_at timestamp with time zone DEFAULT now(),
  details text,
  distance text,
  duration text,
  intensity text,
  feed_type text,
  quantity text,
  unit text,
  medication_name text,
  dosage text,
  route text,
  prescribed_by text,
  description text,
  location text,
  weather text,
  mood text,
  weight numeric,
  temperature numeric,
  heart_rate numeric,
  respiratory_rate numeric,
  duration_minutes integer,
  distance_miles numeric,
  exercise_type text,
  gait text,
  trainer text,
  rider text,
  speed_avg numeric,
  logged_at_barn_id uuid REFERENCES public.barns(id),
  updated_at timestamp with time zone,
  updated_by_user_id uuid REFERENCES public.profiles(id),
  performed_by_user_id uuid,
  performed_by_name text,
  performed_at timestamp with time zone,
  total_cost numeric
);

CREATE TABLE IF NOT EXISTS public.health_records (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  horse_id uuid NOT NULL REFERENCES public.horses(id) ON DELETE CASCADE,
  barn_id uuid REFERENCES public.barns(id),
  recorded_by uuid,
  record_type text NOT NULL,
  provider_name text,
  title text,
  notes text,
  data jsonb DEFAULT '{}'::jsonb,
  record_date date DEFAULT CURRENT_DATE,
  next_due_date date,
  created_at timestamp with time zone DEFAULT now(),
  description text,
  document_url text,
  details text,
  logged_by uuid REFERENCES public.profiles(id),
  logged_at_barn_id uuid REFERENCES public.barns(id),
  updated_at timestamp with time zone,
  updated_by_user_id uuid REFERENCES public.profiles(id),
  performed_by_user_id uuid,
  performed_by_name text,
  performed_at timestamp with time zone,
  total_cost numeric
);

CREATE TABLE IF NOT EXISTS public.access_keys (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  barn_id uuid NOT NULL REFERENCES public.barns(id) ON DELETE CASCADE,
  horse_id uuid REFERENCES public.horses(id),
  key_code text NOT NULL,
  label text,
  permission_level text DEFAULT 'viewer'::text NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  max_uses integer,
  times_used integer DEFAULT 0,
  expires_at timestamp with time zone,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  key_type text DEFAULT 'barn'::text,
  token_hash text
);

CREATE UNIQUE INDEX IF NOT EXISTS access_keys_key_code_unique ON public.access_keys(key_code);
CREATE INDEX IF NOT EXISTS access_keys_barn_id_idx ON public.access_keys(barn_id);

CREATE TABLE IF NOT EXISTS public.key_redemptions (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  key_id uuid NOT NULL REFERENCES public.access_keys(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  redeemed_at timestamp with time zone DEFAULT now(),
  access_key_id uuid
);

CREATE INDEX IF NOT EXISTS key_redemptions_user_id_idx ON public.key_redemptions(user_id);

CREATE TABLE IF NOT EXISTS public.key_requests (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  barn_id uuid NOT NULL REFERENCES public.barns(id) ON DELETE CASCADE,
  horse_id uuid,
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requester_name text,
  requester_email text,
  requester_role text,
  message text,
  status text DEFAULT 'pending'::text,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  full_name text,
  email text,
  desired_role text DEFAULT 'viewer'::text
);

CREATE INDEX IF NOT EXISTS key_requests_barn_id_idx ON public.key_requests(barn_id);

CREATE TABLE IF NOT EXISTS public.log_entry_line_items (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  log_type text NOT NULL,
  log_id uuid NOT NULL,
  description text NOT NULL,
  amount numeric NOT NULL,
  sort_order integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.log_media (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  log_type text NOT NULL CHECK (log_type IN ('activity', 'health')),
  log_id uuid NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('photo', 'video')),
  url text NOT NULL,
  thumbnail_url text,
  caption text,
  sort_order integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_log_media_log ON public.log_media(log_type, log_id);

CREATE TABLE IF NOT EXISTS public.barn_stall_blocks (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  barn_id uuid NOT NULL REFERENCES public.barns(id) ON DELETE CASCADE,
  block_size integer NOT NULL,
  price_cents integer DEFAULT 0 NOT NULL,
  stripe_subscription_item_id text,
  status text DEFAULT 'active'::text NOT NULL,
  added_at timestamp with time zone DEFAULT now() NOT NULL,
  added_by_user_id uuid,
  cancelled_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.paywall_interest (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  user_id uuid,
  barn_id uuid,
  plan_requested text NOT NULL,
  email text NOT NULL,
  message text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  contacted_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  admin_user_id uuid NOT NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  details jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.saved_performers (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  barn_id uuid NOT NULL REFERENCES public.barns(id) ON DELETE CASCADE,
  name text NOT NULL,
  specialty text,
  use_count integer DEFAULT 1 NOT NULL,
  last_used_at timestamp with time zone DEFAULT now() NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.horse_stays (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  horse_id uuid NOT NULL REFERENCES public.horses(id) ON DELETE CASCADE,
  home_barn_id uuid NOT NULL REFERENCES public.barns(id) ON DELETE CASCADE,
  host_barn_id uuid NOT NULL REFERENCES public.barns(id) ON DELETE CASCADE,
  start_date timestamp with time zone DEFAULT now() NOT NULL,
  end_date timestamp with time zone,
  status text DEFAULT 'active'::text NOT NULL CHECK (status IN ('active', 'completed', 'cancelled')),
  created_by_user_id uuid REFERENCES public.profiles(id),
  notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_horse_stays_horse ON public.horse_stays(horse_id);
CREATE INDEX IF NOT EXISTS idx_horse_stays_home ON public.horse_stays(home_barn_id);
CREATE INDEX IF NOT EXISTS idx_horse_stays_host ON public.horse_stays(host_barn_id);
CREATE INDEX IF NOT EXISTS idx_horse_stays_status ON public.horse_stays(status);

CREATE TABLE IF NOT EXISTS public.barn_photos (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  barn_id uuid NOT NULL REFERENCES public.barns(id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  caption text,
  sort_order integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.user_horse_access (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  horse_id uuid NOT NULL REFERENCES public.horses(id) ON DELETE CASCADE,
  source_key_id uuid REFERENCES public.access_keys(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE (user_id, horse_id)
);

CREATE TABLE IF NOT EXISTS public.user_consents (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  terms_version text NOT NULL,
  privacy_version text NOT NULL,
  accepted_at timestamp with time zone DEFAULT now() NOT NULL,
  ip_address text,
  user_agent text
);

CREATE TABLE IF NOT EXISTS public.report_history (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  barn_id uuid NOT NULL REFERENCES public.barns(id) ON DELETE CASCADE,
  report_type text NOT NULL,
  parameters jsonb DEFAULT '{}'::jsonb NOT NULL,
  generated_by_user_id uuid NOT NULL REFERENCES auth.users(id),
  generated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ============================================================
-- FUNCTIONS (SECURITY DEFINER helpers)
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_barn_owner(check_barn_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM barns
    WHERE id = check_barn_id
      AND owner_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_barn_member(check_barn_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM barn_members
    WHERE barn_id = check_barn_id
      AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.barn_can_accept_horses(check_barn_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  barn_capacity integer;
  current_count integer;
  grace_end timestamptz;
BEGIN
  SELECT stall_capacity, grace_period_ends_at
  INTO barn_capacity, grace_end
  FROM barns WHERE id = check_barn_id;

  IF barn_capacity IS NULL THEN
    RETURN false;
  END IF;

  IF grace_end IS NOT NULL AND grace_end > now() THEN
    RETURN false;
  END IF;

  SELECT COUNT(*) INTO current_count
  FROM horses
  WHERE barn_id = check_barn_id AND archived = false;

  RETURN current_count < barn_capacity;
END;
$$;

CREATE OR REPLACE FUNCTION public.user_can_access_horse(p_user_id uuid, p_horse_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM horses h
    JOIN barn_members bm ON bm.barn_id = h.barn_id
    WHERE h.id = p_horse_id
      AND bm.user_id = p_user_id
      AND bm.status = 'active'
  )
  OR EXISTS (
    SELECT 1 FROM horses h
    JOIN barns b ON b.id = h.barn_id
    WHERE h.id = p_horse_id
      AND b.owner_id = p_user_id
  )
  OR EXISTS (
    SELECT 1 FROM horse_stays hs
    JOIN barn_members bm ON bm.barn_id = hs.host_barn_id
    WHERE hs.horse_id = p_horse_id
      AND hs.status = 'active'
      AND bm.user_id = p_user_id
      AND bm.status = 'active'
  )
  OR EXISTS (
    SELECT 1 FROM horse_stays hs
    JOIN barns b ON b.id = hs.host_barn_id
    WHERE hs.horse_id = p_horse_id
      AND hs.status = 'active'
      AND b.owner_id = p_user_id
  )
  OR EXISTS (
    SELECT 1 FROM user_horse_access uha
    WHERE uha.horse_id = p_horse_id
      AND uha.user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION public.redeem_access_key(p_raw_code text, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_key RECORD;
BEGIN
  SELECT * INTO v_key FROM access_keys
  WHERE key_code = p_raw_code AND is_active = true;

  IF v_key IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_key');
  END IF;

  IF v_key.expires_at IS NOT NULL AND v_key.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'expired');
  END IF;

  IF v_key.max_uses IS NOT NULL AND v_key.times_used >= v_key.max_uses THEN
    RETURN jsonb_build_object('ok', false, 'error', 'max_uses_reached');
  END IF;

  UPDATE access_keys SET times_used = times_used + 1 WHERE id = v_key.id;

  INSERT INTO key_redemptions (key_id, user_id, redeemed_at)
  VALUES (v_key.id, p_user_id, now())
  ON CONFLICT DO NOTHING;

  IF v_key.key_type = 'barn' THEN
    INSERT INTO barn_members (barn_id, user_id, role)
    VALUES (v_key.barn_id, p_user_id,
      CASE v_key.permission_level WHEN 'editor' THEN 'editor' ELSE 'viewer' END)
    ON CONFLICT (barn_id, user_id) DO NOTHING;

    RETURN jsonb_build_object(
      'ok', true, 'key_type', 'barn',
      'barn_id', v_key.barn_id, 'horse_id', null
    );
  ELSIF v_key.key_type = 'stall' THEN
    INSERT INTO barn_members (barn_id, user_id, role)
    VALUES (v_key.barn_id, p_user_id, 'viewer')
    ON CONFLICT (barn_id, user_id) DO NOTHING;

    INSERT INTO user_horse_access (user_id, horse_id, source_key_id)
    VALUES (p_user_id, v_key.horse_id, v_key.id)
    ON CONFLICT (user_id, horse_id) DO NOTHING;

    RETURN jsonb_build_object(
      'ok', true, 'key_type', 'stall',
      'barn_id', v_key.barn_id, 'horse_id', v_key.horse_id
    );
  END IF;

  RETURN jsonb_build_object('ok', false, 'error', 'unknown_key_type');
END;
$$;

-- ============================================================
-- TRIGGER: auto-create profile on signup
-- ============================================================

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barn_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.key_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.key_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.log_entry_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.log_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barn_stall_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paywall_interest ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_performers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horse_stays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barn_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_horse_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_history ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- barns
CREATE POLICY "barns_select" ON public.barns FOR SELECT TO authenticated USING ((owner_id = auth.uid()) OR is_barn_member(id));
CREATE POLICY "barns_insert" ON public.barns FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "barns_update" ON public.barns FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "barns_delete" ON public.barns FOR DELETE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "public_read_barns" ON public.barns FOR SELECT TO anon USING (true);

-- barn_members
CREATE POLICY "barn_members_select" ON public.barn_members FOR SELECT TO authenticated USING ((user_id = auth.uid()) OR is_barn_owner(barn_id) OR is_barn_member(barn_id));
CREATE POLICY "barn_members_insert" ON public.barn_members FOR INSERT TO authenticated WITH CHECK (is_barn_owner(barn_id) OR (EXISTS (SELECT 1 FROM barn_members bm WHERE bm.barn_id = barn_members.barn_id AND bm.user_id = auth.uid() AND bm.role IN ('owner', 'manager'))));
CREATE POLICY "barn_members_update" ON public.barn_members FOR UPDATE TO authenticated USING (is_barn_owner(barn_id)) WITH CHECK (is_barn_owner(barn_id));
CREATE POLICY "barn_members_delete" ON public.barn_members FOR DELETE TO authenticated USING (is_barn_owner(barn_id) OR (user_id = auth.uid()));

-- horses
CREATE POLICY "Barn members can view horses" ON public.horses FOR SELECT USING (
  (barn_id IN (SELECT bm.barn_id FROM barn_members bm WHERE bm.user_id = auth.uid()))
  OR (barn_id IN (SELECT b.id FROM barns b WHERE b.owner_id = auth.uid()))
  OR (id IN (SELECT ak.horse_id FROM access_keys ak JOIN key_redemptions kr ON kr.key_id = ak.id WHERE kr.user_id = auth.uid() AND ak.is_active = true AND ak.horse_id IS NOT NULL))
);
CREATE POLICY "Barn editors can insert horses" ON public.horses FOR INSERT WITH CHECK (
  (barn_id IN (SELECT b.id FROM barns b WHERE b.owner_id = auth.uid()))
  OR (barn_id IN (SELECT bm.barn_id FROM barn_members bm WHERE bm.user_id = auth.uid() AND bm.role IN ('owner', 'manager', 'trainer')))
);
CREATE POLICY "Barn editors can update horses" ON public.horses FOR UPDATE USING (
  (barn_id IN (SELECT b.id FROM barns b WHERE b.owner_id = auth.uid()))
  OR (barn_id IN (SELECT bm.barn_id FROM barn_members bm WHERE bm.user_id = auth.uid() AND bm.role IN ('owner', 'manager', 'trainer')))
);
CREATE POLICY "public_read_horses_care" ON public.horses FOR SELECT TO anon USING (true);

-- activity_log
CREATE POLICY "activity_log_select" ON public.activity_log FOR SELECT TO authenticated USING ((logged_by = auth.uid()) OR is_barn_member(barn_id));
CREATE POLICY "activity_log_insert" ON public.activity_log FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "activity_log_update" ON public.activity_log FOR UPDATE TO authenticated USING (logged_by = auth.uid());
CREATE POLICY "activity_log_delete" ON public.activity_log FOR DELETE TO authenticated USING ((logged_by = auth.uid()) OR is_barn_owner(barn_id));

-- health_records
CREATE POLICY "health_records_select" ON public.health_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "health_records_insert" ON public.health_records FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "health_records_update" ON public.health_records FOR UPDATE TO authenticated USING (true);
CREATE POLICY "health_records_delete" ON public.health_records FOR DELETE TO authenticated USING (true);
CREATE POLICY "public_read_health_records" ON public.health_records FOR SELECT TO anon USING (true);

-- access_keys
CREATE POLICY "access_keys_select" ON public.access_keys FOR SELECT TO authenticated USING (true);
CREATE POLICY "access_keys_insert" ON public.access_keys FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "access_keys_update" ON public.access_keys FOR UPDATE TO authenticated USING (true);
CREATE POLICY "access_keys_delete" ON public.access_keys FOR DELETE TO authenticated USING (true);

-- key_redemptions
CREATE POLICY "key_redemptions_select" ON public.key_redemptions FOR SELECT TO authenticated USING (true);
CREATE POLICY "key_redemptions_insert" ON public.key_redemptions FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- key_requests
CREATE POLICY "key_requests_select" ON public.key_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "key_requests_insert" ON public.key_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "key_requests_update" ON public.key_requests FOR UPDATE TO authenticated USING (true);

-- log_entry_line_items
CREATE POLICY "Authenticated users can view line items" ON public.log_entry_line_items FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert line items" ON public.log_entry_line_items FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update line items" ON public.log_entry_line_items FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete line items" ON public.log_entry_line_items FOR DELETE USING (auth.uid() IS NOT NULL);

-- log_media
CREATE POLICY "Authenticated users can view log media" ON public.log_media FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert log media" ON public.log_media FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete log media" ON public.log_media FOR DELETE USING (auth.uid() IS NOT NULL);

-- barn_stall_blocks
CREATE POLICY "Authenticated users can view stall blocks" ON public.barn_stall_blocks FOR SELECT USING (auth.uid() IS NOT NULL);

-- paywall_interest
CREATE POLICY "Users can view their own interest" ON public.paywall_interest FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own interest" ON public.paywall_interest FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- saved_performers
CREATE POLICY "Barn members can view saved performers" ON public.saved_performers FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert saved performers" ON public.saved_performers FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update saved performers" ON public.saved_performers FOR UPDATE USING (auth.uid() IS NOT NULL);

-- horse_stays
CREATE POLICY "Users can view stays for accessible horses" ON public.horse_stays FOR SELECT USING (user_can_access_horse(auth.uid(), horse_id));
CREATE POLICY "Barn owners/managers can create stays" ON public.horse_stays FOR INSERT WITH CHECK ((auth.uid() IS NOT NULL) AND (created_by_user_id = auth.uid()));
CREATE POLICY "Barn owners/managers can update stays" ON public.horse_stays FOR UPDATE USING (user_can_access_horse(auth.uid(), horse_id));

-- barn_photos
CREATE POLICY "auth_read_barn_photos" ON public.barn_photos FOR SELECT TO authenticated USING (true);
CREATE POLICY "public_read_barn_photos" ON public.barn_photos FOR SELECT TO anon USING (true);
CREATE POLICY "auth_manage_barn_photos" ON public.barn_photos FOR ALL TO authenticated USING (
  (EXISTS (SELECT 1 FROM barn_members WHERE barn_members.barn_id = barn_photos.barn_id AND barn_members.user_id = auth.uid() AND barn_members.role IN ('owner', 'manager')))
  OR (EXISTS (SELECT 1 FROM barns WHERE barns.id = barn_photos.barn_id AND barns.owner_id = auth.uid()))
);

-- user_horse_access
CREATE POLICY "uha_select" ON public.user_horse_access FOR SELECT TO authenticated USING (true);
CREATE POLICY "uha_insert" ON public.user_horse_access FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "uha_delete" ON public.user_horse_access FOR DELETE TO authenticated USING (user_id = auth.uid());

-- user_consents
CREATE POLICY "Users can view their own consents" ON public.user_consents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own consents" ON public.user_consents FOR INSERT WITH CHECK (auth.uid() = user_id);

-- report_history
CREATE POLICY "Barn members can view report history" ON public.report_history FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert report history" ON public.report_history FOR INSERT WITH CHECK ((auth.uid() IS NOT NULL) AND (generated_by_user_id = auth.uid()));

-- ============================================================
-- GRANT RPC access
-- ============================================================
REVOKE ALL ON FUNCTION public.redeem_access_key(text, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.redeem_access_key(text, uuid) TO authenticated;

-- ============================================================
-- DONE! Staging database mirrors production schema.
-- ============================================================
