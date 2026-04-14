-- ==========================================================================
-- Breeders Pro — Transfer embryo with inline surrogate creation
--
-- Adds transfer_embryo_with_surrogate(...): atomic RPC that resolves or
-- creates the recipient mare, inserts the pregnancy row, flips the embryo
-- status to 'transferred', and marks the surrogate as 'bred' — all inside
-- one transaction so a mid-flow failure leaves nothing behind.
--
-- Scope rules respected:
--   * Does NOT replace `transferEmbryoAction` or any existing server code.
--     The old path remains operational for the BarnBook embryo-bank route.
--   * Does NOT change any table schema, RLS policy, index, or trigger.
--   * Does NOT change any metric calculation. Expected-foaling date is
--     computed as `transfer_date + 340 days`, matching the inline logic
--     already in `transferEmbryoAction`.
--
-- Idempotent: CREATE OR REPLACE. Safe to re-run.
-- Reversible: `DROP FUNCTION public.transfer_embryo_with_surrogate(
--   uuid, jsonb, date, text, text, uuid);`
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.transfer_embryo_with_surrogate(
  p_embryo_id          uuid,
  p_surrogate_input    jsonb,   -- {id: uuid} OR {name, breed?, color?, foal_date?, registration_number?}
  p_transfer_date      date,
  p_transfer_vet_name  text,
  p_notes              text,
  p_created_by         uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_embryo            RECORD;
  v_surrogate_id      uuid;
  v_created_surrogate boolean := false;
  v_pregnancy_id      uuid;
  v_expected_foal     date;
BEGIN
  ------------------------------------------------------------------
  -- 1. Load and guard the embryo
  ------------------------------------------------------------------
  SELECT id, barn_id, donor_horse_id, stallion_horse_id, status
    INTO v_embryo
    FROM public.embryos
   WHERE id = p_embryo_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Embryo % not found', p_embryo_id;
  END IF;

  IF v_embryo.status NOT IN ('in_bank_fresh', 'in_bank_frozen') THEN
    RAISE EXCEPTION
      'Embryo % is not available for transfer (current status: %)',
      p_embryo_id, v_embryo.status;
  END IF;

  ------------------------------------------------------------------
  -- 2. Resolve or create the surrogate mare
  ------------------------------------------------------------------
  IF p_surrogate_input IS NULL THEN
    RAISE EXCEPTION 'Surrogate input is required';
  END IF;

  IF p_surrogate_input ? 'id' AND NULLIF(p_surrogate_input->>'id', '') IS NOT NULL THEN
    -- Existing horse path
    v_surrogate_id := (p_surrogate_input->>'id')::uuid;

    IF NOT EXISTS (
      SELECT 1 FROM public.horses
       WHERE id = v_surrogate_id
         AND barn_id = v_embryo.barn_id
    ) THEN
      RAISE EXCEPTION 'Surrogate % not found in barn %',
        v_surrogate_id, v_embryo.barn_id;
    END IF;

    -- Only upgrade from 'none' to 'recipient'; never downgrade a
    -- 'donor'/'stallion'/'multiple' role.
    UPDATE public.horses
       SET breeding_role = 'recipient',
           updated_at = now()
     WHERE id = v_surrogate_id
       AND breeding_role = 'none';
  ELSE
    -- Inline-create path
    IF NULLIF(trim(COALESCE(p_surrogate_input->>'name', '')), '') IS NULL THEN
      RAISE EXCEPTION 'Surrogate name is required';
    END IF;

    INSERT INTO public.horses (
      barn_id, name, sex, breed, color, foal_date,
      registration_number, breeding_role, created_by, status
    ) VALUES (
      v_embryo.barn_id,
      trim(p_surrogate_input->>'name'),
      'mare',
      NULLIF(trim(COALESCE(p_surrogate_input->>'breed', '')), ''),
      NULLIF(trim(COALESCE(p_surrogate_input->>'color', '')), ''),
      NULLIF(p_surrogate_input->>'foal_date', '')::date,
      NULLIF(trim(COALESCE(p_surrogate_input->>'registration_number', '')), ''),
      'recipient',
      p_created_by,
      'active'
    ) RETURNING id INTO v_surrogate_id;

    v_created_surrogate := true;
  END IF;

  ------------------------------------------------------------------
  -- 3. Create pregnancy record
  --    Expected foaling date = transfer date + 340 days, same formula
  --    used by the legacy inline action.
  ------------------------------------------------------------------
  v_expected_foal := p_transfer_date + 340;

  INSERT INTO public.pregnancies (
    barn_id, embryo_id, surrogate_horse_id,
    donor_horse_id, stallion_horse_id,
    transfer_date, transfer_veterinarian_name,
    expected_foaling_date, notes, created_by_user_id
  ) VALUES (
    v_embryo.barn_id, p_embryo_id, v_surrogate_id,
    v_embryo.donor_horse_id, v_embryo.stallion_horse_id,
    p_transfer_date,
    NULLIF(trim(COALESCE(p_transfer_vet_name, '')), ''),
    v_expected_foal,
    NULLIF(trim(COALESCE(p_notes, '')), ''),
    p_created_by
  ) RETURNING id INTO v_pregnancy_id;

  ------------------------------------------------------------------
  -- 4. Flip embryo status to 'transferred'
  ------------------------------------------------------------------
  UPDATE public.embryos
     SET status = 'transferred',
         updated_at = now()
   WHERE id = p_embryo_id;

  ------------------------------------------------------------------
  -- 5. Mark the surrogate's reproductive status
  ------------------------------------------------------------------
  UPDATE public.horses
     SET reproductive_status = 'bred',
         updated_at = now()
   WHERE id = v_surrogate_id;

  ------------------------------------------------------------------
  -- 6. Return the result
  ------------------------------------------------------------------
  RETURN jsonb_build_object(
    'ok',                 true,
    'pregnancy_id',       v_pregnancy_id,
    'surrogate_horse_id', v_surrogate_id,
    'created_surrogate',  v_created_surrogate
  );
END;
$$;
