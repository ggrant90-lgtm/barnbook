-- ==========================================================================
-- Breeders Pro — event-first flush creation
--
-- Adds create_flush_with_horses_and_embryos(...): a transactional wrapper
-- around the existing create_flush_with_embryos RPC that can ALSO resolve
-- or create the donor mare and barn stallion from inline input, so the
-- Breeders Pro "Record Flush" flow can start from a blank roster.
--
-- Scope rules respected:
--   * Does NOT replace or modify create_flush_with_embryos.
--   * Does NOT change any table schema, RLS policy, index, or trigger.
--   * Does NOT change any metric calculation — delegates entirely to the
--     existing RPC for flush/embryo/financial/lifetime-count logic.
--
-- Idempotent: CREATE OR REPLACE. Safe to re-run.
-- Reversible: `DROP FUNCTION public.create_flush_with_horses_and_embryos(
--   uuid, jsonb, jsonb, text, text, date, text, text, integer, numeric,
--   text, uuid, text[], text[], text[]);`
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.create_flush_with_horses_and_embryos(
  p_barn_id                        uuid,
  p_donor_input                    jsonb,   -- {id: uuid} OR {name, breed?, color?, foal_date?, registration_number?}
  p_stallion_input                 jsonb,   -- same shape as donor, OR NULL when using an external sire
  p_external_stallion_name         text,    -- used only when p_stallion_input IS NULL
  p_external_stallion_registration text,
  p_flush_date                     date,
  p_veterinarian_name              text,
  p_breeding_method                text,
  p_embryo_count                   integer,
  p_flush_cost                     numeric,
  p_notes                          text,
  p_created_by                     uuid,
  p_grades                         text[],
  p_stages                         text[],
  p_labels                         text[] DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_donor_id          uuid;
  v_stallion_id       uuid;
  v_created_donor     boolean := false;
  v_created_stallion  boolean := false;
  v_base_result       jsonb;
BEGIN
  ------------------------------------------------------------------
  -- 1. Resolve or create DONOR mare
  ------------------------------------------------------------------
  IF p_donor_input IS NULL THEN
    RAISE EXCEPTION 'Donor mare is required';
  END IF;

  IF p_donor_input ? 'id' AND NULLIF(p_donor_input->>'id', '') IS NOT NULL THEN
    -- Existing horse path
    v_donor_id := (p_donor_input->>'id')::uuid;

    IF NOT EXISTS (
      SELECT 1 FROM public.horses
       WHERE id = v_donor_id
         AND barn_id = p_barn_id
    ) THEN
      RAISE EXCEPTION 'Donor horse % not found in barn %', v_donor_id, p_barn_id;
    END IF;

    -- Only upgrade from 'none' to 'donor'; never downgrade a 'stallion' or 'multiple'.
    UPDATE public.horses
       SET breeding_role = 'donor',
           updated_at = now()
     WHERE id = v_donor_id
       AND breeding_role = 'none';
  ELSE
    -- Inline-create path
    IF NULLIF(trim(COALESCE(p_donor_input->>'name', '')), '') IS NULL THEN
      RAISE EXCEPTION 'Donor mare name is required';
    END IF;

    INSERT INTO public.horses (
      barn_id, name, sex, breed, color, foal_date,
      registration_number, breeding_role, created_by, status
    ) VALUES (
      p_barn_id,
      trim(p_donor_input->>'name'),
      'mare',
      NULLIF(trim(COALESCE(p_donor_input->>'breed', '')), ''),
      NULLIF(trim(COALESCE(p_donor_input->>'color', '')), ''),
      NULLIF(p_donor_input->>'foal_date', '')::date,
      NULLIF(trim(COALESCE(p_donor_input->>'registration_number', '')), ''),
      'donor',
      p_created_by,
      'active'
    ) RETURNING id INTO v_donor_id;

    v_created_donor := true;
  END IF;

  ------------------------------------------------------------------
  -- 2. Resolve or create BARN STALLION (or leave NULL for external sire)
  ------------------------------------------------------------------
  IF p_stallion_input IS NOT NULL THEN
    IF p_stallion_input ? 'id' AND NULLIF(p_stallion_input->>'id', '') IS NOT NULL THEN
      v_stallion_id := (p_stallion_input->>'id')::uuid;

      IF NOT EXISTS (
        SELECT 1 FROM public.horses
         WHERE id = v_stallion_id
           AND barn_id = p_barn_id
      ) THEN
        RAISE EXCEPTION 'Stallion horse % not found in barn %', v_stallion_id, p_barn_id;
      END IF;

      UPDATE public.horses
         SET breeding_role = 'stallion',
             updated_at = now()
       WHERE id = v_stallion_id
         AND breeding_role = 'none';
    ELSE
      IF NULLIF(trim(COALESCE(p_stallion_input->>'name', '')), '') IS NULL THEN
        RAISE EXCEPTION 'Stallion name is required when creating a new barn stallion';
      END IF;

      INSERT INTO public.horses (
        barn_id, name, sex, breed, color, foal_date,
        registration_number, breeding_role, created_by, status
      ) VALUES (
        p_barn_id,
        trim(p_stallion_input->>'name'),
        'stallion',
        NULLIF(trim(COALESCE(p_stallion_input->>'breed', '')), ''),
        NULLIF(trim(COALESCE(p_stallion_input->>'color', '')), ''),
        NULLIF(p_stallion_input->>'foal_date', '')::date,
        NULLIF(trim(COALESCE(p_stallion_input->>'registration_number', '')), ''),
        'stallion',
        p_created_by,
        'active'
      ) RETURNING id INTO v_stallion_id;

      v_created_stallion := true;
    END IF;
  END IF;

  ------------------------------------------------------------------
  -- 3. Delegate to the existing flush + embryos + financial logic.
  --    External stallion fields are only forwarded when no barn
  --    stallion is selected — mirrors the existing call contract.
  ------------------------------------------------------------------
  v_base_result := public.create_flush_with_embryos(
    p_barn_id,
    v_donor_id,
    v_stallion_id,
    CASE WHEN v_stallion_id IS NULL THEN NULLIF(trim(COALESCE(p_external_stallion_name, '')), '')         ELSE NULL END,
    CASE WHEN v_stallion_id IS NULL THEN NULLIF(trim(COALESCE(p_external_stallion_registration, '')), '') ELSE NULL END,
    p_flush_date,
    p_veterinarian_name,
    p_breeding_method,
    p_embryo_count,
    p_flush_cost,
    p_notes,
    p_created_by,
    p_grades,
    p_stages,
    p_labels
  );

  ------------------------------------------------------------------
  -- 4. Return the base result plus the horse-resolution metadata.
  ------------------------------------------------------------------
  RETURN v_base_result
    || jsonb_build_object(
         'donor_horse_id',    v_donor_id,
         'stallion_horse_id', v_stallion_id,
         'created_donor',     v_created_donor,
         'created_stallion',  v_created_stallion
       );
END;
$$;
