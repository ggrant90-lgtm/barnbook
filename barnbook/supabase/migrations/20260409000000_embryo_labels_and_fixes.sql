-- Add custom label column to embryos
ALTER TABLE public.embryos ADD COLUMN IF NOT EXISTS label text DEFAULT NULL;

-- Update create_flush_with_embryos to accept labels
CREATE OR REPLACE FUNCTION public.create_flush_with_embryos(
  p_barn_id uuid,
  p_donor_horse_id uuid,
  p_stallion_horse_id uuid,
  p_external_stallion_name text,
  p_external_stallion_registration text,
  p_flush_date date,
  p_veterinarian_name text,
  p_breeding_method text,
  p_embryo_count integer,
  p_flush_cost numeric,
  p_notes text,
  p_created_by uuid,
  p_grades text[],
  p_stages text[],
  p_labels text[] DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_flush_id uuid;
  v_embryo_ids uuid[] := '{}';
  v_embryo_codes text[] := '{}';
  v_code text;
  v_eid uuid;
  v_grade text;
  v_stage text;
  v_label text;
BEGIN
  -- Create flush record
  INSERT INTO flushes (
    barn_id, donor_horse_id, stallion_horse_id,
    external_stallion_name, external_stallion_registration,
    flush_date, veterinarian_name, breeding_method,
    embryo_count, flush_cost, notes, created_by_user_id
  ) VALUES (
    p_barn_id, p_donor_horse_id, p_stallion_horse_id,
    p_external_stallion_name, p_external_stallion_registration,
    p_flush_date, p_veterinarian_name, p_breeding_method,
    p_embryo_count, p_flush_cost, p_notes, p_created_by
  ) RETURNING id INTO v_flush_id;

  -- Create N embryo records
  FOR i IN 1..p_embryo_count LOOP
    v_code := generate_embryo_code(p_barn_id);
    v_grade := COALESCE(p_grades[i], 'grade_1');
    v_stage := COALESCE(p_stages[i], 'morula');
    v_label := NULLIF(COALESCE(p_labels[i], ''), '');

    INSERT INTO embryos (
      barn_id, flush_id, donor_horse_id,
      stallion_horse_id, external_stallion_name,
      embryo_code, label, grade, stage, status,
      created_by_user_id
    ) VALUES (
      p_barn_id, v_flush_id, p_donor_horse_id,
      p_stallion_horse_id, p_external_stallion_name,
      v_code, v_label, v_grade, v_stage, 'in_bank_fresh',
      p_created_by
    ) RETURNING id INTO v_eid;

    v_embryo_ids := v_embryo_ids || v_eid;
    v_embryo_codes := v_embryo_codes || v_code;
  END LOOP;

  -- Update donor's lifetime embryo count
  UPDATE horses
  SET lifetime_embryo_count = lifetime_embryo_count + p_embryo_count,
      updated_at = now()
  WHERE id = p_donor_horse_id;

  -- If flush cost provided, create financial record
  IF p_flush_cost IS NOT NULL AND p_flush_cost > 0 THEN
    INSERT INTO financial_records (
      barn_id, flush_id, horse_id, category, amount,
      record_date, created_by_user_id
    ) VALUES (
      p_barn_id, v_flush_id, p_donor_horse_id, 'vet_flush',
      p_flush_cost, p_flush_date, p_created_by
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'flush_id', v_flush_id,
    'embryo_ids', to_jsonb(v_embryo_ids),
    'embryo_codes', to_jsonb(v_embryo_codes)
  );
END;
$$;
