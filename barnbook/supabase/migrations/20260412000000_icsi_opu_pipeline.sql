-- =============================================================
-- Pass 12a — ICSI / OPU Pipeline
--
-- Adds the full upstream pipeline for ICSI breeding:
--   1. icsi_labs        — reusable lab entities (pick or create)
--   2. opu_sessions     — aspiration events on donor mares
--   3. oocytes          — individual oocyte tracking with codes
--   4. icsi_batches     — per-stallion lab processing batches
--   5. embryos modified — nullable flush_id, new icsi columns
--   6. Code generators  — OC-YYYY-NNNN for oocytes
--   7. RLS policies     — mirrors existing barn-scoped pattern
--   8. RPC              — atomic OPU session + oocyte creation
--
-- Existing data is unaffected. All changes are additive.
-- =============================================================

-- ============================================================
-- 1. ICSI Labs (follows locations/facilities pattern)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.icsi_labs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barn_id uuid NOT NULL REFERENCES public.barns(id) ON DELETE CASCADE,
  name text NOT NULL,
  address_line_1 text,
  address_line_2 text,
  city text,
  state_province text,
  postal_code text,
  country text DEFAULT 'US',
  contact_name text,
  contact_phone text,
  contact_email text,
  notes text,
  archived boolean NOT NULL DEFAULT false,
  created_by_user_id uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_icsi_labs_barn
  ON public.icsi_labs(barn_id);

-- RLS
ALTER TABLE public.icsi_labs ENABLE ROW LEVEL SECURITY;

CREATE POLICY icsi_labs_select ON public.icsi_labs
  FOR SELECT USING (
    barn_id IN (
      SELECT barn_id FROM public.barn_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY icsi_labs_insert ON public.icsi_labs
  FOR INSERT WITH CHECK (
    barn_id IN (
      SELECT barn_id FROM public.barn_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'manager', 'member')
    )
  );

CREATE POLICY icsi_labs_update ON public.icsi_labs
  FOR UPDATE USING (
    barn_id IN (
      SELECT barn_id FROM public.barn_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'manager', 'member')
    )
  );

-- ============================================================
-- 2. OPU Sessions (aspiration events)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.opu_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barn_id uuid NOT NULL REFERENCES public.barns(id) ON DELETE CASCADE,
  donor_horse_id uuid NOT NULL REFERENCES public.horses(id),
  opu_date date NOT NULL DEFAULT CURRENT_DATE,
  veterinarian text,
  facility text,
  oocytes_recovered integer NOT NULL DEFAULT 0,
  oocytes_mature integer,
  oocytes_immature integer,
  cost numeric,
  notes text,
  created_by_user_id uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_opu_sessions_barn
  ON public.opu_sessions(barn_id);
CREATE INDEX IF NOT EXISTS idx_opu_sessions_donor
  ON public.opu_sessions(donor_horse_id);

-- RLS
ALTER TABLE public.opu_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY opu_sessions_select ON public.opu_sessions
  FOR SELECT USING (
    barn_id IN (
      SELECT barn_id FROM public.barn_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY opu_sessions_insert ON public.opu_sessions
  FOR INSERT WITH CHECK (
    barn_id IN (
      SELECT barn_id FROM public.barn_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'manager', 'member')
    )
  );

CREATE POLICY opu_sessions_update ON public.opu_sessions
  FOR UPDATE USING (
    barn_id IN (
      SELECT barn_id FROM public.barn_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'manager', 'member')
    )
  );

-- ============================================================
-- 3. Oocytes (individual tracking with auto-generated codes)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.oocytes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barn_id uuid NOT NULL REFERENCES public.barns(id) ON DELETE CASCADE,
  opu_session_id uuid NOT NULL REFERENCES public.opu_sessions(id) ON DELETE CASCADE,
  donor_horse_id uuid NOT NULL REFERENCES public.horses(id),
  oocyte_code text NOT NULL,
  label text,
  oocyte_number integer NOT NULL,
  maturity text NOT NULL DEFAULT 'unknown'
    CHECK (maturity IN ('mature', 'immature', 'degenerate', 'unknown')),
  status text NOT NULL DEFAULT 'recovered'
    CHECK (status IN (
      'recovered',
      'shipped',
      'at_lab',
      'injected',
      'developed',
      'failed'
    )),
  failure_reason text
    CHECK (failure_reason IS NULL OR failure_reason IN (
      'immature',
      'failed_fertilization',
      'arrested',
      'degenerated',
      'other'
    )),
  icsi_batch_id uuid,  -- FK added after icsi_batches table exists
  embryo_id uuid,       -- FK added after embryos modification
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_oocytes_code
  ON public.oocytes(oocyte_code);
CREATE INDEX IF NOT EXISTS idx_oocytes_barn
  ON public.oocytes(barn_id);
CREATE INDEX IF NOT EXISTS idx_oocytes_opu
  ON public.oocytes(opu_session_id);
CREATE INDEX IF NOT EXISTS idx_oocytes_donor
  ON public.oocytes(donor_horse_id);
CREATE INDEX IF NOT EXISTS idx_oocytes_batch
  ON public.oocytes(icsi_batch_id);

-- RLS
ALTER TABLE public.oocytes ENABLE ROW LEVEL SECURITY;

CREATE POLICY oocytes_select ON public.oocytes
  FOR SELECT USING (
    barn_id IN (
      SELECT barn_id FROM public.barn_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY oocytes_insert ON public.oocytes
  FOR INSERT WITH CHECK (
    barn_id IN (
      SELECT barn_id FROM public.barn_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'manager', 'member')
    )
  );

CREATE POLICY oocytes_update ON public.oocytes
  FOR UPDATE USING (
    barn_id IN (
      SELECT barn_id FROM public.barn_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'manager', 'member')
    )
  );

-- ============================================================
-- 4. ICSI Batches (per-stallion processing at a lab)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.icsi_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barn_id uuid NOT NULL REFERENCES public.barns(id) ON DELETE CASCADE,
  opu_session_id uuid NOT NULL REFERENCES public.opu_sessions(id),
  stallion_horse_id uuid NOT NULL REFERENCES public.horses(id),
  lab_id uuid REFERENCES public.icsi_labs(id),
  semen_type text
    CHECK (semen_type IS NULL OR semen_type IN ('fresh', 'cooled', 'frozen')),
  shipped_date date,
  received_date date,
  icsi_date date,
  results_date date,
  ship_tracking_to_lab text,
  ship_tracking_from_lab text,
  lab_report_notes text,
  cost numeric,
  shipping_cost numeric,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending',
      'shipped',
      'at_lab',
      'processing',
      'results_ready',
      'complete'
    )),
  notes text,
  created_by_user_id uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_icsi_batches_barn
  ON public.icsi_batches(barn_id);
CREATE INDEX IF NOT EXISTS idx_icsi_batches_opu
  ON public.icsi_batches(opu_session_id);
CREATE INDEX IF NOT EXISTS idx_icsi_batches_stallion
  ON public.icsi_batches(stallion_horse_id);
CREATE INDEX IF NOT EXISTS idx_icsi_batches_lab
  ON public.icsi_batches(lab_id);

-- RLS
ALTER TABLE public.icsi_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY icsi_batches_select ON public.icsi_batches
  FOR SELECT USING (
    barn_id IN (
      SELECT barn_id FROM public.barn_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY icsi_batches_insert ON public.icsi_batches
  FOR INSERT WITH CHECK (
    barn_id IN (
      SELECT barn_id FROM public.barn_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'manager', 'member')
    )
  );

CREATE POLICY icsi_batches_update ON public.icsi_batches
  FOR UPDATE USING (
    barn_id IN (
      SELECT barn_id FROM public.barn_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'manager', 'member')
    )
  );

-- ============================================================
-- 5. Add FK constraints to oocytes now that icsi_batches exists
-- ============================================================
ALTER TABLE public.oocytes
  ADD CONSTRAINT oocytes_icsi_batch_fk
  FOREIGN KEY (icsi_batch_id) REFERENCES public.icsi_batches(id);

-- ============================================================
-- 6. Modify embryos table for ICSI source
-- ============================================================

-- Allow embryos without a flush (ICSI embryos come from batches, not flushes)
ALTER TABLE public.embryos
  ALTER COLUMN flush_id DROP NOT NULL;

-- Add ICSI-specific columns
ALTER TABLE public.embryos
  ADD COLUMN IF NOT EXISTS icsi_batch_id uuid REFERENCES public.icsi_batches(id);
ALTER TABLE public.embryos
  ADD COLUMN IF NOT EXISTS oocyte_id uuid REFERENCES public.oocytes(id);
ALTER TABLE public.embryos
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'flush'
    CHECK (source_type IN ('flush', 'icsi'));

CREATE INDEX IF NOT EXISTS idx_embryos_icsi_batch
  ON public.embryos(icsi_batch_id);
CREATE INDEX IF NOT EXISTS idx_embryos_oocyte
  ON public.embryos(oocyte_id);
CREATE INDEX IF NOT EXISTS idx_embryos_source_type
  ON public.embryos(source_type);

-- Now add the oocyte → embryo FK
ALTER TABLE public.oocytes
  ADD CONSTRAINT oocytes_embryo_fk
  FOREIGN KEY (embryo_id) REFERENCES public.embryos(id);

-- ============================================================
-- 7. Oocyte code generator (OC-YYYY-NNNN, global sequential)
--
-- Mirrors the embryo code generator pattern. Global MAX across
-- all barns because the unique index is global (same reasoning
-- as the embryo code fix we applied earlier).
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_oocyte_code(p_barn_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_year text;
  v_seq  integer;
  v_code text;
BEGIN
  v_year := to_char(now(), 'YYYY');

  -- Global MAX across all barns (unique index is global)
  SELECT COALESCE(
           MAX(CAST(substring(oocyte_code FROM '^OC-\d{4}-(\d+)$') AS integer)),
           0
         ) + 1
    INTO v_seq
    FROM public.oocytes
   WHERE oocyte_code ~ ('^OC-' || v_year || '-\d+$');

  v_code := 'OC-' || v_year || '-' || lpad(v_seq::text, 4, '0');
  RETURN v_code;
END;
$$;

-- ============================================================
-- 8. Atomic OPU session + oocyte creation RPC
--
-- Creates an OPU session row and N individual oocyte rows in
-- one transaction. Each oocyte gets an auto-generated code
-- (OC-YYYY-NNNN). Returns the session id and oocyte codes.
--
-- Mirrors create_flush_with_embryos pattern.
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_opu_with_oocytes(
  p_barn_id             uuid,
  p_donor_horse_id      uuid,
  p_opu_date            date,
  p_veterinarian        text,
  p_facility            text,
  p_oocytes_recovered   integer,
  p_oocytes_mature      integer,
  p_oocytes_immature    integer,
  p_cost                numeric,
  p_notes               text,
  p_created_by          uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_session_id    uuid;
  v_oocyte_codes  text[] := '{}';
  v_code          text;
  i               integer;
BEGIN
  -- 1. Create the OPU session
  INSERT INTO public.opu_sessions (
    barn_id, donor_horse_id, opu_date, veterinarian,
    facility, oocytes_recovered, oocytes_mature, oocytes_immature,
    cost, notes, created_by_user_id
  ) VALUES (
    p_barn_id, p_donor_horse_id, p_opu_date, p_veterinarian,
    p_facility, p_oocytes_recovered, p_oocytes_mature, p_oocytes_immature,
    p_cost, p_notes, p_created_by
  )
  RETURNING id INTO v_session_id;

  -- 2. Create individual oocyte rows with auto-generated codes
  FOR i IN 1..p_oocytes_recovered LOOP
    v_code := generate_oocyte_code(p_barn_id);

    INSERT INTO public.oocytes (
      barn_id, opu_session_id, donor_horse_id,
      oocyte_code, oocyte_number, maturity, status
    ) VALUES (
      p_barn_id, v_session_id, p_donor_horse_id,
      v_code, i,
      -- If maturity counts provided, auto-assign:
      -- first p_oocytes_mature get 'mature', next p_oocytes_immature
      -- get 'immature', rest get 'unknown'
      CASE
        WHEN p_oocytes_mature IS NOT NULL AND i <= p_oocytes_mature THEN 'mature'
        WHEN p_oocytes_immature IS NOT NULL
             AND p_oocytes_mature IS NOT NULL
             AND i <= (p_oocytes_mature + p_oocytes_immature) THEN 'immature'
        ELSE 'unknown'
      END,
      'recovered'
    );

    v_oocyte_codes := v_oocyte_codes || v_code;
  END LOOP;

  RETURN jsonb_build_object(
    'opu_session_id', v_session_id,
    'oocyte_codes', to_jsonb(v_oocyte_codes),
    'oocytes_created', p_oocytes_recovered
  );
END;
$$;

-- ============================================================
-- 9. Atomic ICSI results recording RPC
--
-- Takes an ICSI batch id and an array of per-oocyte results.
-- For each oocyte marked as 'developed', creates an embryo row
-- (source_type='icsi') and links it back to the oocyte.
-- Updates oocyte statuses in bulk.
-- ============================================================
CREATE OR REPLACE FUNCTION public.record_icsi_results(
  p_batch_id uuid,
  p_results  jsonb  -- array of {oocyte_id, outcome: 'developed'|'failed', failure_reason?, grade?, stage?}
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_batch         record;
  v_result        jsonb;
  v_oocyte_id     uuid;
  v_outcome       text;
  v_grade         text;
  v_stage         text;
  v_failure       text;
  v_embryo_id     uuid;
  v_embryo_code   text;
  v_embryos_created integer := 0;
  v_embryo_codes  text[] := '{}';
BEGIN
  -- Fetch batch details for barn_id and stallion
  SELECT * INTO v_batch FROM public.icsi_batches WHERE id = p_batch_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ICSI batch not found: %', p_batch_id;
  END IF;

  -- Process each oocyte result
  FOR v_result IN SELECT * FROM jsonb_array_elements(p_results)
  LOOP
    v_oocyte_id := (v_result->>'oocyte_id')::uuid;
    v_outcome   := v_result->>'outcome';
    v_grade     := COALESCE(v_result->>'grade', 'grade_1');
    v_stage     := COALESCE(v_result->>'stage', 'blastocyst');
    v_failure   := v_result->>'failure_reason';

    IF v_outcome = 'developed' THEN
      -- Generate an embryo code and create the embryo row
      v_embryo_code := generate_embryo_code(v_batch.barn_id);

      INSERT INTO public.embryos (
        barn_id, flush_id, icsi_batch_id, oocyte_id,
        donor_horse_id, stallion_horse_id,
        embryo_code, grade, stage, status, source_type,
        created_by_user_id
      ) VALUES (
        v_batch.barn_id,
        NULL,  -- no flush for ICSI embryos
        p_batch_id,
        v_oocyte_id,
        (SELECT donor_horse_id FROM public.opu_sessions WHERE id = v_batch.opu_session_id),
        v_batch.stallion_horse_id,
        v_embryo_code,
        v_grade,
        v_stage,
        'in_bank_fresh',
        'icsi',
        (SELECT created_by_user_id FROM public.icsi_batches WHERE id = p_batch_id)
      )
      RETURNING id INTO v_embryo_id;

      -- Link oocyte → embryo and mark as developed
      UPDATE public.oocytes
         SET status = 'developed',
             embryo_id = v_embryo_id,
             updated_at = now()
       WHERE id = v_oocyte_id;

      v_embryos_created := v_embryos_created + 1;
      v_embryo_codes := v_embryo_codes || v_embryo_code;

    ELSIF v_outcome = 'failed' THEN
      UPDATE public.oocytes
         SET status = 'failed',
             failure_reason = v_failure,
             updated_at = now()
       WHERE id = v_oocyte_id;
    END IF;
  END LOOP;

  -- Mark batch as complete
  UPDATE public.icsi_batches
     SET status = 'complete',
         results_date = CURRENT_DATE,
         updated_at = now()
   WHERE id = p_batch_id;

  RETURN jsonb_build_object(
    'embryos_created', v_embryos_created,
    'embryo_codes', to_jsonb(v_embryo_codes)
  );
END;
$$;

-- ============================================================
-- 10. Verify: show structure of new tables
-- ============================================================
SELECT 'icsi_labs' AS tbl, count(*) FROM public.icsi_labs
UNION ALL
SELECT 'opu_sessions', count(*) FROM public.opu_sessions
UNION ALL
SELECT 'oocytes', count(*) FROM public.oocytes
UNION ALL
SELECT 'icsi_batches', count(*) FROM public.icsi_batches;

-- Verify embryos table has new columns
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_name = 'embryos'
   AND column_name IN ('flush_id', 'icsi_batch_id', 'oocyte_id', 'source_type')
 ORDER BY column_name;
