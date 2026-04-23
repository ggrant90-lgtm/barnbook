-- ==========================================================================
-- Phase A — Stall Key bug fix + RLS hardening + granular permission schema
-- ==========================================================================
-- Fixes three issues at once:
--
--   1. STALL KEY VISIBILITY BUG (security-critical)
--      The redeem_access_key RPC was inserting stall-key users into
--      barn_members with role='viewer'. Once in barn_members, the horses
--      SELECT RLS gave them barn-wide visibility — defeating the entire
--      point of a "one horse" key. Fix: RPC no longer inserts stall-key
--      users into barn_members; rewrite horses SELECT RLS to call the
--      existing user_can_access_horse() helper (which already handles
--      both key types correctly).
--
--   2. PERMISSIVE RLS ON health_records (security-critical)
--      SELECT / UPDATE / DELETE were all `USING (true)`. Any authenticated
--      BarnBook user could read / edit / delete any horse's health records
--      across the entire platform. Fixed by scoping to
--      user_can_access_horse() + user_can_log_entry().
--
--   3. PERMISSIVE RLS ON log_media (security-critical)
--      Same hole, same fix — scope via the parent log entry's horse_id.
--
-- Also sets up the SCHEMA for granular key permissions (Phase B lights up
-- the UI). Additive only — no one loses access they had yesterday.
--
-- Idempotent: IF NOT EXISTS / DROP IF EXISTS / CHECK constraint grandfathers
-- legacy values.
--
-- NOTE ON anon POLICIES: `public_read_horses_care` and
-- `public_read_health_records` (TO anon USING true) are left untouched.
-- They back the public care-card feature. If those need tightening,
-- that's a separate product change — out of scope here.
-- ==========================================================================


-- ── 1. Schema additions ──────────────────────────────────────────────────

-- access_keys: expand permission_level values + add allowed_log_types.
ALTER TABLE public.access_keys
  DROP CONSTRAINT IF EXISTS access_keys_permission_level_check;

-- Grandfather the legacy 'viewer' / 'editor' values for back-compat.
-- A follow-up migration can tighten this once all rows are backfilled.
ALTER TABLE public.access_keys
  ADD CONSTRAINT access_keys_permission_level_check
  CHECK (permission_level IN (
    'view_only', 'log_all', 'full_contributor', 'custom',
    'viewer', 'editor'
  ));

ALTER TABLE public.access_keys
  ADD COLUMN IF NOT EXISTS allowed_log_types text[];

-- barn_members: permission metadata copied from the key at redemption.
ALTER TABLE public.barn_members
  ADD COLUMN IF NOT EXISTS permission_level text NOT NULL DEFAULT 'log_all';
ALTER TABLE public.barn_members
  ADD COLUMN IF NOT EXISTS allowed_log_types text[];

-- user_horse_access: same columns so stall-key permission lookups don't
-- require a join back to access_keys.
ALTER TABLE public.user_horse_access
  ADD COLUMN IF NOT EXISTS permission_level text NOT NULL DEFAULT 'log_all';
ALTER TABLE public.user_horse_access
  ADD COLUMN IF NOT EXISTS allowed_log_types text[];

-- Map legacy permission_level values on existing keys to the new vocabulary.
UPDATE public.access_keys
  SET permission_level = 'view_only' WHERE permission_level = 'viewer';
UPDATE public.access_keys
  SET permission_level = 'log_all'   WHERE permission_level = 'editor';

CREATE INDEX IF NOT EXISTS idx_user_horse_access_horse
  ON public.user_horse_access(horse_id);
CREATE INDEX IF NOT EXISTS idx_barn_members_permission
  ON public.barn_members(user_id, barn_id);


-- ── 2. SECURITY DEFINER helper: user_can_log_entry ───────────────────────

CREATE OR REPLACE FUNCTION public.user_can_log_entry(
  p_user_id uuid,
  p_horse_id uuid,
  p_log_type text
) RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_barn_id uuid;
  v_perm text;
  v_allowed text[];
BEGIN
  SELECT barn_id INTO v_barn_id FROM public.horses WHERE id = p_horse_id;
  IF v_barn_id IS NULL THEN RETURN false; END IF;

  -- Barn owner always wins.
  IF EXISTS (
    SELECT 1 FROM public.barns
    WHERE id = v_barn_id AND owner_id = p_user_id
  ) THEN
    RETURN true;
  END IF;

  -- Pick the most permissive grant across barn_members + user_horse_access.
  SELECT permission_level, allowed_log_types
    INTO v_perm, v_allowed
  FROM (
    SELECT permission_level, allowed_log_types,
           CASE permission_level
             WHEN 'full_contributor' THEN 1
             WHEN 'log_all' THEN 2
             WHEN 'custom' THEN 3
             WHEN 'view_only' THEN 4
             ELSE 5
           END AS priority
    FROM public.barn_members
    WHERE user_id = p_user_id
      AND barn_id = v_barn_id
      AND status = 'active'

    UNION ALL

    SELECT permission_level, allowed_log_types,
           CASE permission_level
             WHEN 'full_contributor' THEN 1
             WHEN 'log_all' THEN 2
             WHEN 'custom' THEN 3
             WHEN 'view_only' THEN 4
             ELSE 5
           END AS priority
    FROM public.user_horse_access
    WHERE user_id = p_user_id AND horse_id = p_horse_id
  ) grants
  ORDER BY priority ASC
  LIMIT 1;

  IF v_perm IS NULL THEN RETURN false; END IF;

  RETURN CASE v_perm
    WHEN 'view_only' THEN false
    WHEN 'log_all' THEN true
    WHEN 'full_contributor' THEN true
    WHEN 'custom' THEN p_log_type = ANY(COALESCE(v_allowed, ARRAY[]::text[]))
    ELSE false
  END;
END;
$$;


-- ── 3. Rewrite redeem_access_key RPC ─────────────────────────────────────
-- Bug fix: stall-key branch NO LONGER inserts into barn_members. Stall-key
-- access lives exclusively in user_horse_access. Also copies the key's
-- permission metadata into whichever membership row is created.

CREATE OR REPLACE FUNCTION public.redeem_access_key(
  p_raw_code text,
  p_user_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key RECORD;
  v_role text;
BEGIN
  SELECT * INTO v_key FROM public.access_keys
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

  UPDATE public.access_keys
     SET times_used = times_used + 1
   WHERE id = v_key.id;

  INSERT INTO public.key_redemptions (key_id, user_id, redeemed_at)
  VALUES (v_key.id, p_user_id, now())
  ON CONFLICT DO NOTHING;

  IF v_key.key_type = 'barn' THEN
    -- Map new permission levels to the legacy role column so
    -- isEditorPlusRole and friends keep working until Phase B.
    v_role := CASE v_key.permission_level
                WHEN 'view_only' THEN 'viewer'
                WHEN 'log_all' THEN 'editor'
                WHEN 'full_contributor' THEN 'editor'
                WHEN 'custom' THEN 'editor'
                WHEN 'viewer' THEN 'viewer'   -- grandfathered
                WHEN 'editor' THEN 'editor'   -- grandfathered
                ELSE 'viewer'
              END;

    INSERT INTO public.barn_members (
      barn_id, user_id, role, permission_level, allowed_log_types
    )
    VALUES (
      v_key.barn_id, p_user_id, v_role,
      v_key.permission_level, v_key.allowed_log_types
    )
    ON CONFLICT (barn_id, user_id) DO UPDATE
      SET permission_level = EXCLUDED.permission_level,
          allowed_log_types = EXCLUDED.allowed_log_types;

    RETURN jsonb_build_object(
      'ok', true,
      'key_type', 'barn',
      'barn_id', v_key.barn_id,
      'horse_id', NULL
    );

  ELSIF v_key.key_type = 'stall' THEN
    -- FIX: no longer insert into barn_members. Stall-key users live in
    -- user_horse_access only, which the horses RLS + user_can_access_horse
    -- helper correctly scope to the specific horse.
    INSERT INTO public.user_horse_access (
      user_id, horse_id, source_key_id, permission_level, allowed_log_types
    )
    VALUES (
      p_user_id, v_key.horse_id, v_key.id,
      v_key.permission_level, v_key.allowed_log_types
    )
    ON CONFLICT (user_id, horse_id) DO UPDATE
      SET permission_level = EXCLUDED.permission_level,
          allowed_log_types = EXCLUDED.allowed_log_types,
          source_key_id = EXCLUDED.source_key_id;

    RETURN jsonb_build_object(
      'ok', true,
      'key_type', 'stall',
      'barn_id', v_key.barn_id,
      'horse_id', v_key.horse_id
    );
  END IF;

  RETURN jsonb_build_object('ok', false, 'error', 'unknown_key_type');
END;
$$;


-- ── 4. Cleanup: remove stall-key-injected barn_members rows ─────────────
-- These rows were created by the buggy RPC. They're identifiable as:
--   role='viewer' AND the user has user_horse_access for a horse in this barn
--   AND they don't have any active barn-key redemption for this barn.
--
-- This may occasionally remove a direct-invited 'viewer' who also holds a
-- stall key — an acceptable tradeoff given the security fix. Owners can
-- always re-invite.

DELETE FROM public.barn_members bm
WHERE bm.role = 'viewer'
  AND EXISTS (
    SELECT 1 FROM public.user_horse_access uha
    JOIN public.horses h ON h.id = uha.horse_id
    WHERE uha.user_id = bm.user_id
      AND h.barn_id = bm.barn_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.key_redemptions kr
    JOIN public.access_keys ak ON ak.id = kr.key_id
    WHERE kr.user_id = bm.user_id
      AND ak.barn_id = bm.barn_id
      AND ak.key_type = 'barn'
      AND ak.is_active = true
  );


-- ── 5. Rewrite RLS policies ─────────────────────────────────────────────
-- Atomic within a single migration — Supabase runs each migration in a
-- transaction, so there's never a gap where no policy is active.

-- horses: SELECT via user_can_access_horse (handles owner + barn key + stall key)
DROP POLICY IF EXISTS "Barn members can view horses" ON public.horses;
CREATE POLICY horses_select ON public.horses
  FOR SELECT TO authenticated
  USING (public.user_can_access_horse(auth.uid(), id));

-- horses: UPDATE owner-only. Hard rule per spec.
DROP POLICY IF EXISTS "Barn editors can update horses" ON public.horses;
CREATE POLICY horses_update ON public.horses
  FOR UPDATE TO authenticated
  USING (is_barn_owner(barn_id));

-- activity_log: replace the permissive policies with access-scoped ones.
DROP POLICY IF EXISTS activity_log_select ON public.activity_log;
CREATE POLICY activity_log_select ON public.activity_log
  FOR SELECT TO authenticated
  USING (public.user_can_access_horse(auth.uid(), horse_id));

DROP POLICY IF EXISTS activity_log_insert ON public.activity_log;
CREATE POLICY activity_log_insert ON public.activity_log
  FOR INSERT TO authenticated
  WITH CHECK (public.user_can_log_entry(auth.uid(), horse_id, activity_type));

DROP POLICY IF EXISTS activity_log_update ON public.activity_log;
CREATE POLICY activity_log_update ON public.activity_log
  FOR UPDATE TO authenticated
  USING (
    is_barn_owner((SELECT barn_id FROM public.horses WHERE id = horse_id))
    OR (
      logged_by = auth.uid()
      AND public.user_can_log_entry(auth.uid(), horse_id, activity_type)
    )
  );

DROP POLICY IF EXISTS activity_log_delete ON public.activity_log;
CREATE POLICY activity_log_delete ON public.activity_log
  FOR DELETE TO authenticated
  USING (
    is_barn_owner((SELECT barn_id FROM public.horses WHERE id = horse_id))
    OR (
      logged_by = auth.uid()
      AND public.user_can_log_entry(auth.uid(), horse_id, activity_type)
    )
  );

-- health_records: close the USING(true) holes.
DROP POLICY IF EXISTS health_records_select ON public.health_records;
CREATE POLICY health_records_select ON public.health_records
  FOR SELECT TO authenticated
  USING (public.user_can_access_horse(auth.uid(), horse_id));

DROP POLICY IF EXISTS health_records_insert ON public.health_records;
CREATE POLICY health_records_insert ON public.health_records
  FOR INSERT TO authenticated
  WITH CHECK (public.user_can_log_entry(auth.uid(), horse_id, record_type));

DROP POLICY IF EXISTS health_records_update ON public.health_records;
CREATE POLICY health_records_update ON public.health_records
  FOR UPDATE TO authenticated
  USING (
    is_barn_owner((SELECT barn_id FROM public.horses WHERE id = horse_id))
    OR (
      logged_by = auth.uid()
      AND public.user_can_log_entry(auth.uid(), horse_id, record_type)
    )
  );

DROP POLICY IF EXISTS health_records_delete ON public.health_records;
CREATE POLICY health_records_delete ON public.health_records
  FOR DELETE TO authenticated
  USING (
    is_barn_owner((SELECT barn_id FROM public.horses WHERE id = horse_id))
    OR (
      logged_by = auth.uid()
      AND public.user_can_log_entry(auth.uid(), horse_id, record_type)
    )
  );

-- log_media: scope via the parent log entry's horse_id.
DROP POLICY IF EXISTS "Authenticated users can view log media" ON public.log_media;
DROP POLICY IF EXISTS "Authenticated users can insert log media" ON public.log_media;
DROP POLICY IF EXISTS "Authenticated users can delete log media" ON public.log_media;

CREATE POLICY log_media_select ON public.log_media
  FOR SELECT TO authenticated
  USING (
    public.user_can_access_horse(
      auth.uid(),
      CASE log_type
        WHEN 'activity' THEN (SELECT horse_id FROM public.activity_log WHERE id = log_id)
        WHEN 'health' THEN (SELECT horse_id FROM public.health_records WHERE id = log_id)
        ELSE NULL
      END
    )
  );

-- Inserting log media: user must be allowed to edit the parent log entry,
-- which means they either own the barn or they created the entry and have
-- a non-view-only permission.
CREATE POLICY log_media_insert ON public.log_media
  FOR INSERT TO authenticated
  WITH CHECK (
    CASE log_type
      WHEN 'activity' THEN EXISTS (
        SELECT 1 FROM public.activity_log al
        WHERE al.id = log_id
          AND (
            is_barn_owner((SELECT barn_id FROM public.horses WHERE id = al.horse_id))
            OR (
              al.logged_by = auth.uid()
              AND public.user_can_log_entry(auth.uid(), al.horse_id, al.activity_type)
            )
          )
      )
      WHEN 'health' THEN EXISTS (
        SELECT 1 FROM public.health_records hr
        WHERE hr.id = log_id
          AND (
            is_barn_owner((SELECT barn_id FROM public.horses WHERE id = hr.horse_id))
            OR (
              hr.logged_by = auth.uid()
              AND public.user_can_log_entry(auth.uid(), hr.horse_id, hr.record_type)
            )
          )
      )
      ELSE false
    END
  );

-- Deleting log media: barn owner OR the user who created the parent log entry.
CREATE POLICY log_media_delete ON public.log_media
  FOR DELETE TO authenticated
  USING (
    CASE log_type
      WHEN 'activity' THEN EXISTS (
        SELECT 1 FROM public.activity_log al
        WHERE al.id = log_id
          AND (
            is_barn_owner((SELECT barn_id FROM public.horses WHERE id = al.horse_id))
            OR al.logged_by = auth.uid()
          )
      )
      WHEN 'health' THEN EXISTS (
        SELECT 1 FROM public.health_records hr
        WHERE hr.id = log_id
          AND (
            is_barn_owner((SELECT barn_id FROM public.horses WHERE id = hr.horse_id))
            OR hr.logged_by = auth.uid()
          )
      )
      ELSE false
    END
  );


-- ── 6. Grants ───────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.user_can_log_entry(uuid, uuid, text) TO authenticated;
