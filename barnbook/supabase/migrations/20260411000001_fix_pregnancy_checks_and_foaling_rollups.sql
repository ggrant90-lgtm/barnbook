-- ============================================================
-- Breeders Pro — Fix pregnancy check dates + foaling rollups
-- ============================================================
--
-- Two fixes bundled into one migration:
--
--   1. Adds the five missing `check_N_day_date` columns to
--      `pregnancies`. The existing `logPregnancyCheckAction` has
--      always been writing to these columns (check_14_day_date,
--      check_30_day_date, etc.) but the columns were never
--      actually created. Logging any pregnancy check has been
--      erroring out in the schema cache. This adds the columns
--      as nullable dates so the existing code just works.
--
--   2. Updates `record_foaling` to increment the donor mare's
--      `lifetime_live_foal_count` (and the stallion's, if the
--      embryo was sired by a barn stallion) when a foal is born
--      alive. Prior behavior only updated the foaling row, the
--      pregnancy status, and the surrogate's reproductive
--      status — the donor and sire rollup counters never moved,
--      so their profile "Lifetime Foals" metric stayed at 0.
--
-- Both fixes are strictly additive. No data is lost, no existing
-- rows are modified. Safe to run against an already-populated DB.
-- Idempotent — can be re-run without side effects.
--
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Missing pregnancy check date columns
-- ============================================================

ALTER TABLE public.pregnancies
  ADD COLUMN IF NOT EXISTS check_14_day_date date;

ALTER TABLE public.pregnancies
  ADD COLUMN IF NOT EXISTS check_30_day_date date;

ALTER TABLE public.pregnancies
  ADD COLUMN IF NOT EXISTS check_45_day_date date;

ALTER TABLE public.pregnancies
  ADD COLUMN IF NOT EXISTS check_60_day_date date;

ALTER TABLE public.pregnancies
  ADD COLUMN IF NOT EXISTS check_90_day_date date;

-- ============================================================
-- 2. Updated record_foaling RPC
-- ============================================================
--
-- Only the increment section is new. Everything else is identical
-- to the prior definition (20260408000000_embryo_asset_flow.sql,
-- lines 333–end). Re-declared in full because Postgres doesn't
-- support partial function updates.
--
-- New behavior: after inserting the foaling row and updating
-- statuses, increment lifetime_live_foal_count on the donor mare.
-- If the embryo was sired by a barn stallion (stallion_horse_id IS
-- NOT NULL), increment the stallion's counter too. Both only
-- increment when p_foal_alive_24hr is TRUE — a stillbirth does
-- not count against lifetime counters.

CREATE OR REPLACE FUNCTION public.record_foaling(
  p_barn_id uuid,
  p_pregnancy_id uuid,
  p_foaling_date date,
  p_foaling_time text,
  p_foaling_type text,
  p_foal_sex text,
  p_foal_color text,
  p_foal_markings text,
  p_birth_weight_lbs numeric,
  p_placenta_passed boolean,
  p_iga_result text,
  p_foal_alive_24hr boolean,
  p_complications text,
  p_attending_vet text,
  p_notes text,
  p_created_by uuid,
  p_create_horse boolean DEFAULT true,
  p_foal_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pregnancy RECORD;
  v_embryo RECORD;
  v_foaling_id uuid;
  v_foal_horse_id uuid;
  v_donor_name text;
  v_stallion_name text;
BEGIN
  -- Fetch pregnancy and related embryo
  SELECT * INTO v_pregnancy FROM pregnancies WHERE id = p_pregnancy_id;
  IF v_pregnancy IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'pregnancy_not_found');
  END IF;

  SELECT * INTO v_embryo FROM embryos WHERE id = v_pregnancy.embryo_id;

  -- Get names for foal record
  SELECT name INTO v_donor_name FROM horses WHERE id = v_pregnancy.donor_horse_id;
  SELECT COALESCE(
    (SELECT name FROM horses WHERE id = v_embryo.stallion_horse_id),
    v_embryo.external_stallion_name
  ) INTO v_stallion_name;

  -- Optionally create foal horse record
  IF p_create_horse AND p_foal_alive_24hr IS NOT FALSE THEN
    INSERT INTO horses (
      barn_id, name, sex, color, foal_date,
      sire_horse_id, dam_horse_id,
      sire, dam,
      breeding_role, created_by, qr_code
    ) VALUES (
      p_barn_id,
      COALESCE(p_foal_name, v_donor_name || ' x ' || COALESCE(v_stallion_name, 'Unknown') || ' Foal'),
      CASE p_foal_sex WHEN 'colt' THEN 'Stallion' WHEN 'filly' THEN 'Mare' ELSE NULL END,
      p_foal_color,
      p_foaling_date,
      v_embryo.stallion_horse_id,
      v_pregnancy.donor_horse_id,
      v_stallion_name,
      v_donor_name,
      'none',
      p_created_by,
      gen_random_uuid()::text
    ) RETURNING id INTO v_foal_horse_id;
  END IF;

  -- Create foaling record
  INSERT INTO foalings (
    barn_id, pregnancy_id, surrogate_horse_id, foal_horse_id,
    foaling_date, foaling_time, foaling_type, foal_sex,
    foal_color, foal_markings, birth_weight_lbs,
    placenta_passed_normally, iga_test_result,
    foal_alive_at_24hr, complications, attending_vet_name,
    notes, created_by_user_id
  ) VALUES (
    p_barn_id, p_pregnancy_id, v_pregnancy.surrogate_horse_id, v_foal_horse_id,
    p_foaling_date, p_foaling_time, p_foaling_type, p_foal_sex,
    p_foal_color, p_foal_markings, p_birth_weight_lbs,
    p_placenta_passed, p_iga_result,
    p_foal_alive_24hr, p_complications, p_attending_vet,
    p_notes, p_created_by
  ) RETURNING id INTO v_foaling_id;

  -- Update pregnancy status
  UPDATE pregnancies SET status = 'foaled', updated_at = now() WHERE id = p_pregnancy_id;

  -- Update embryo status
  UPDATE embryos SET status = 'became_foal', updated_at = now() WHERE id = v_pregnancy.embryo_id;

  -- Update surrogate reproductive status
  UPDATE horses SET reproductive_status = 'post_foaling', updated_at = now()
  WHERE id = v_pregnancy.surrogate_horse_id;

  -- NEW: Roll up lifetime counts onto donor and sire
  -- (only for live foals at 24hr)
  IF p_foal_alive_24hr IS NOT FALSE THEN
    -- Donor mare always exists
    UPDATE horses
       SET lifetime_live_foal_count = lifetime_live_foal_count + 1,
           updated_at = now()
     WHERE id = v_pregnancy.donor_horse_id;

    -- Stallion only if the embryo was sired by a barn stallion
    IF v_embryo.stallion_horse_id IS NOT NULL THEN
      UPDATE horses
         SET lifetime_live_foal_count = lifetime_live_foal_count + 1,
             updated_at = now()
       WHERE id = v_embryo.stallion_horse_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'foaling_id', v_foaling_id,
    'foal_horse_id', v_foal_horse_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_foaling(
  uuid, uuid, date, text, text, text, text, text, numeric,
  boolean, text, boolean, text, text, text, uuid, boolean, text
) TO authenticated;

COMMIT;
