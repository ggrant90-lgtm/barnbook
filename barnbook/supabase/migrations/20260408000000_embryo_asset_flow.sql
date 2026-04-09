-- Embryo Asset Flow Migration
-- Feature 1: Horse breeding extensions
-- Feature 2: Flushes table
-- Feature 3: Embryos table (core asset)
-- Feature 4: Pregnancies table
-- Feature 5: Foalings table
-- Feature 6: Financial records table
-- Feature 7: RPC functions for transactional workflows
-- Feature 8: RLS policies

-- ============================================================
-- Feature 1: Horse breeding extensions
-- ============================================================
ALTER TABLE public.horses
  ADD COLUMN IF NOT EXISTS breeding_role text DEFAULT 'none'
    CHECK (breeding_role IN ('donor', 'recipient', 'stallion', 'multiple', 'none')),
  ADD COLUMN IF NOT EXISTS reproductive_status text
    CHECK (reproductive_status IN ('open', 'in_cycle', 'bred', 'confirmed_pregnant', 'foaling', 'post_foaling', 'retired')),
  ADD COLUMN IF NOT EXISTS recipient_herd_id text,
  ADD COLUMN IF NOT EXISTS stallion_stud_fee numeric,
  ADD COLUMN IF NOT EXISTS lifetime_embryo_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lifetime_live_foal_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sire_horse_id uuid REFERENCES public.horses(id),
  ADD COLUMN IF NOT EXISTS dam_horse_id uuid REFERENCES public.horses(id);

CREATE INDEX IF NOT EXISTS idx_horses_breeding_role ON public.horses(barn_id, breeding_role);
CREATE INDEX IF NOT EXISTS idx_horses_sire ON public.horses(sire_horse_id);
CREATE INDEX IF NOT EXISTS idx_horses_dam ON public.horses(dam_horse_id);

-- ============================================================
-- Feature 2: Flushes table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.flushes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barn_id uuid NOT NULL REFERENCES public.barns(id) ON DELETE CASCADE,
  donor_horse_id uuid NOT NULL REFERENCES public.horses(id) ON DELETE CASCADE,
  stallion_horse_id uuid REFERENCES public.horses(id),
  external_stallion_name text,
  external_stallion_registration text,
  flush_date date NOT NULL DEFAULT CURRENT_DATE,
  veterinarian_name text,
  breeding_method text NOT NULL DEFAULT 'ai_fresh'
    CHECK (breeding_method IN ('ai_fresh', 'ai_cooled', 'ai_frozen', 'live_cover')),
  embryo_count integer NOT NULL DEFAULT 0,
  flush_cost numeric,
  notes text,
  photos jsonb,
  created_by_user_id uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_flushes_barn ON public.flushes(barn_id);
CREATE INDEX IF NOT EXISTS idx_flushes_donor ON public.flushes(donor_horse_id);
CREATE INDEX IF NOT EXISTS idx_flushes_stallion ON public.flushes(stallion_horse_id);
CREATE INDEX IF NOT EXISTS idx_flushes_date ON public.flushes(flush_date);

-- ============================================================
-- Feature 3: Embryos table (core asset)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.embryos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barn_id uuid NOT NULL REFERENCES public.barns(id) ON DELETE CASCADE,
  flush_id uuid NOT NULL REFERENCES public.flushes(id) ON DELETE CASCADE,
  donor_horse_id uuid NOT NULL REFERENCES public.horses(id),
  stallion_horse_id uuid REFERENCES public.horses(id),
  external_stallion_name text,
  embryo_code text NOT NULL,
  grade text NOT NULL DEFAULT 'grade_1'
    CHECK (grade IN ('grade_1', 'grade_2', 'grade_3', 'grade_4', 'degenerate')),
  stage text NOT NULL DEFAULT 'morula'
    CHECK (stage IN ('morula', 'early_blastocyst', 'blastocyst', 'expanded_blastocyst', 'hatched_blastocyst')),
  status text NOT NULL DEFAULT 'in_bank_fresh'
    CHECK (status IN ('in_bank_fresh', 'in_bank_frozen', 'transferred', 'became_foal', 'lost', 'shipped_out')),
  -- Storage fields (for frozen embryos)
  storage_facility text,
  storage_tank text,
  storage_cane text,
  storage_position text,
  freeze_date date,
  freeze_method text CHECK (freeze_method IN ('vitrification', 'slow_freeze')),
  -- Loss fields
  loss_reason text CHECK (loss_reason IN ('degenerated', 'transfer_failure', 'early_pregnancy_loss', 'late_pregnancy_loss', 'other')),
  loss_date date,
  loss_notes text,
  -- Ship fields
  shipped_to text,
  ship_date date,
  sale_price numeric,
  -- General
  notes text,
  photo_url text,
  created_by_user_id uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_embryos_code ON public.embryos(embryo_code);
CREATE INDEX IF NOT EXISTS idx_embryos_barn_status ON public.embryos(barn_id, status);
CREATE INDEX IF NOT EXISTS idx_embryos_flush ON public.embryos(flush_id);
CREATE INDEX IF NOT EXISTS idx_embryos_donor ON public.embryos(donor_horse_id);
CREATE INDEX IF NOT EXISTS idx_embryos_stallion ON public.embryos(stallion_horse_id);

-- ============================================================
-- Feature 4: Pregnancies table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pregnancies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barn_id uuid NOT NULL REFERENCES public.barns(id) ON DELETE CASCADE,
  embryo_id uuid NOT NULL REFERENCES public.embryos(id),
  surrogate_horse_id uuid NOT NULL REFERENCES public.horses(id),
  donor_horse_id uuid NOT NULL REFERENCES public.horses(id),
  stallion_horse_id uuid REFERENCES public.horses(id),
  transfer_date date NOT NULL DEFAULT CURRENT_DATE,
  transfer_veterinarian_name text,
  expected_foaling_date date,
  status text NOT NULL DEFAULT 'pending_check'
    CHECK (status IN ('pending_check', 'confirmed', 'lost_early', 'lost_late', 'foaled', 'aborted')),
  -- Pregnancy checks
  check_14_day text NOT NULL DEFAULT 'pending'
    CHECK (check_14_day IN ('pending', 'confirmed', 'not_pregnant', 'not_done')),
  check_30_day text NOT NULL DEFAULT 'pending'
    CHECK (check_30_day IN ('pending', 'confirmed', 'not_pregnant', 'not_done')),
  check_45_day text NOT NULL DEFAULT 'pending'
    CHECK (check_45_day IN ('pending', 'confirmed', 'not_pregnant', 'not_done')),
  check_60_day text NOT NULL DEFAULT 'pending'
    CHECK (check_60_day IN ('pending', 'confirmed', 'not_pregnant', 'not_done')),
  check_90_day text NOT NULL DEFAULT 'pending'
    CHECK (check_90_day IN ('pending', 'confirmed', 'not_pregnant', 'not_done')),
  -- Loss
  loss_date date,
  loss_reason text,
  notes text,
  created_by_user_id uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pregnancies_barn_status ON public.pregnancies(barn_id, status);
CREATE INDEX IF NOT EXISTS idx_pregnancies_surrogate ON public.pregnancies(surrogate_horse_id);
CREATE INDEX IF NOT EXISTS idx_pregnancies_embryo ON public.pregnancies(embryo_id);
CREATE INDEX IF NOT EXISTS idx_pregnancies_donor ON public.pregnancies(donor_horse_id);

-- ============================================================
-- Feature 5: Foalings table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.foalings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barn_id uuid NOT NULL REFERENCES public.barns(id) ON DELETE CASCADE,
  pregnancy_id uuid NOT NULL REFERENCES public.pregnancies(id),
  surrogate_horse_id uuid NOT NULL REFERENCES public.horses(id),
  foal_horse_id uuid REFERENCES public.horses(id),
  foaling_date date NOT NULL DEFAULT CURRENT_DATE,
  foaling_time text,
  foaling_type text NOT NULL DEFAULT 'normal'
    CHECK (foaling_type IN ('normal', 'assisted', 'dystocia', 'c_section', 'stillborn')),
  foal_sex text NOT NULL CHECK (foal_sex IN ('colt', 'filly')),
  foal_color text,
  foal_markings text,
  birth_weight_lbs numeric,
  placenta_passed_normally boolean,
  iga_test_result text CHECK (iga_test_result IN ('adequate', 'marginal', 'failure', 'not_tested')),
  foal_alive_at_24hr boolean,
  foal_alive_at_30d boolean,
  complications text,
  attending_vet_name text,
  photos jsonb,
  notes text,
  created_by_user_id uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_foalings_barn ON public.foalings(barn_id);
CREATE INDEX IF NOT EXISTS idx_foalings_pregnancy ON public.foalings(pregnancy_id);
CREATE INDEX IF NOT EXISTS idx_foalings_surrogate ON public.foalings(surrogate_horse_id);
CREATE INDEX IF NOT EXISTS idx_foalings_foal ON public.foalings(foal_horse_id);

-- ============================================================
-- Feature 6: Financial records table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.financial_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barn_id uuid NOT NULL REFERENCES public.barns(id) ON DELETE CASCADE,
  flush_id uuid REFERENCES public.flushes(id),
  embryo_id uuid REFERENCES public.embryos(id),
  pregnancy_id uuid REFERENCES public.pregnancies(id),
  horse_id uuid REFERENCES public.horses(id),
  category text NOT NULL
    CHECK (category IN (
      'stud_fee', 'collection_shipping', 'vet_cycle', 'vet_flush',
      'vet_transfer', 'vet_ultrasound', 'vet_other', 'medications',
      'surrogate_lease', 'surrogate_board', 'freezing_storage',
      'shipping', 'registration', 'other'
    )),
  amount numeric NOT NULL,
  record_date date NOT NULL DEFAULT CURRENT_DATE,
  vendor text,
  paid boolean NOT NULL DEFAULT false,
  notes text,
  created_by_user_id uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_financial_barn ON public.financial_records(barn_id);
CREATE INDEX IF NOT EXISTS idx_financial_flush ON public.financial_records(flush_id);
CREATE INDEX IF NOT EXISTS idx_financial_embryo ON public.financial_records(embryo_id);
CREATE INDEX IF NOT EXISTS idx_financial_pregnancy ON public.financial_records(pregnancy_id);
CREATE INDEX IF NOT EXISTS idx_financial_horse ON public.financial_records(horse_id);

-- ============================================================
-- Feature 7: RPC functions
-- ============================================================

-- Embryo code generator (sequential per barn per year: CB-YYYY-NNNN)
CREATE OR REPLACE FUNCTION public.generate_embryo_code(p_barn_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_year text;
  v_seq integer;
  v_code text;
BEGIN
  v_year := to_char(now(), 'YYYY');

  SELECT COUNT(*) + 1 INTO v_seq
  FROM embryos
  WHERE barn_id = p_barn_id
    AND embryo_code LIKE 'CB-' || v_year || '-%';

  v_code := 'CB-' || v_year || '-' || lpad(v_seq::text, 4, '0');
  RETURN v_code;
END;
$$;

-- Transactional flush creation: creates flush + N embryos + updates donor count
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
  p_stages text[]
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

    INSERT INTO embryos (
      barn_id, flush_id, donor_horse_id,
      stallion_horse_id, external_stallion_name,
      embryo_code, grade, stage, status,
      created_by_user_id
    ) VALUES (
      p_barn_id, v_flush_id, p_donor_horse_id,
      p_stallion_horse_id, p_external_stallion_name,
      v_code, v_grade, v_stage, 'in_bank_fresh',
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

-- Transactional foaling: creates foaling + updates pregnancy/embryo/surrogate + optionally creates foal horse
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

  RETURN jsonb_build_object(
    'ok', true,
    'foaling_id', v_foaling_id,
    'foal_horse_id', v_foal_horse_id
  );
END;
$$;

-- ============================================================
-- Feature 8: RLS policies
-- ============================================================

-- Flushes
ALTER TABLE public.flushes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "flushes_select" ON public.flushes
  FOR SELECT TO authenticated
  USING (is_barn_member(barn_id) OR is_barn_owner(barn_id));

CREATE POLICY "flushes_insert" ON public.flushes
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "flushes_update" ON public.flushes
  FOR UPDATE TO authenticated
  USING (is_barn_owner(barn_id) OR is_barn_member(barn_id));

-- Embryos
ALTER TABLE public.embryos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "embryos_select" ON public.embryos
  FOR SELECT TO authenticated
  USING (is_barn_member(barn_id) OR is_barn_owner(barn_id));

CREATE POLICY "embryos_insert" ON public.embryos
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "embryos_update" ON public.embryos
  FOR UPDATE TO authenticated
  USING (is_barn_member(barn_id) OR is_barn_owner(barn_id));

-- Pregnancies
ALTER TABLE public.pregnancies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pregnancies_select" ON public.pregnancies
  FOR SELECT TO authenticated
  USING (is_barn_member(barn_id) OR is_barn_owner(barn_id));

CREATE POLICY "pregnancies_insert" ON public.pregnancies
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "pregnancies_update" ON public.pregnancies
  FOR UPDATE TO authenticated
  USING (is_barn_member(barn_id) OR is_barn_owner(barn_id));

-- Foalings
ALTER TABLE public.foalings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "foalings_select" ON public.foalings
  FOR SELECT TO authenticated
  USING (is_barn_member(barn_id) OR is_barn_owner(barn_id));

CREATE POLICY "foalings_insert" ON public.foalings
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "foalings_update" ON public.foalings
  FOR UPDATE TO authenticated
  USING (is_barn_member(barn_id) OR is_barn_owner(barn_id));

-- Financial records
ALTER TABLE public.financial_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "financial_records_select" ON public.financial_records
  FOR SELECT TO authenticated
  USING (is_barn_member(barn_id) OR is_barn_owner(barn_id));

CREATE POLICY "financial_records_insert" ON public.financial_records
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "financial_records_update" ON public.financial_records
  FOR UPDATE TO authenticated
  USING (is_barn_owner(barn_id));
