-- ============================================================
-- Breeders Pro — Horse Lifecycle & Locations
-- ============================================================
--
-- Pass 7 foundation. Adds:
--
--   1. `locations` — a per-barn facility registry. A location is an
--      entity with a facility name and an address. Multiple horses can
--      reference the same location.
--
--   2. `horse_location_assignments` — historical log of where each horse
--      has been. One row per assignment. The active assignment has
--      `ended_at IS NULL`. Moving a horse closes out the current
--      assignment (sets ended_at) and inserts a new one.
--
--   3. Disposition columns on `horses` — captures what happened to a
--      horse as an asset in the program (sold, died, retired from
--      program). Distinct from `reproductive_status`, which is about
--      breeding cycle state.
--
--   4. `horse_current_location` view — a read-only join for displaying
--      the current facility + per-assignment note on a horse. Used by
--      the surrogate profile header and the surrogates list.
--
--   5. Atomic RPCs:
--        - `move_horse_to_location` — accepts an existing location id OR
--          a new location input (facility_name + address fields) as
--          jsonb, closes out the previous assignment, inserts the new
--          one, all in one transaction. Follows the same "pick-or-create"
--          pattern as the flush and transfer RPCs.
--        - `record_horse_disposition` — sets disposition + date + notes,
--          archives the horse, closes out the current location assignment.
--          One call for Mark Sold / Died / Retired.
--        - `unarchive_horse` — reverses a disposition. Clears the
--          disposition fields, un-archives the horse. Does NOT restore
--          the prior location assignment (user must set a new one).
--
-- Design notes
-- -------------
--
-- * The lifecycle model is role-agnostic. "Record Foaling" and "Record
--   Pregnancy Loss" are pregnancy-driven (they operate on an active
--   pregnancy, whoever it belongs to) and therefore work for both
--   embryo-transfer surrogates today and live-cover mares when that
--   breeding method ships. No changes required in this migration for
--   live cover — the existing `pregnancies` table already stores donor
--   and sire independently from any embryo link.
--
-- * Locations are scoped by `barn_id` (matching the existing
--   single-barn-per-user plumbing). RLS follows the same pattern as
--   flushes/embryos/pregnancies via `is_barn_member` / `is_barn_owner`.
--
-- * Disposition is an optional text enum via CHECK constraint rather
--   than a true enum type, so future values can be added without a
--   schema migration against the enum.
--
-- * `horse_location_assignments.barn_id` is denormalized from horses
--   to simplify RLS policies — same pattern used in flushes and embryos.
--
-- ============================================================

BEGIN;

-- ============================================================
-- 1. locations
-- ============================================================

CREATE TABLE IF NOT EXISTS public.locations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barn_id               uuid NOT NULL REFERENCES public.barns(id) ON DELETE CASCADE,
  facility_name         text NOT NULL,
  address_line_1        text,
  address_line_2        text,
  city                  text,
  state_province        text,
  postal_code           text,
  country               text,
  notes                 text,
  archived              boolean NOT NULL DEFAULT false,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  created_by_user_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Same facility name can't exist twice under one barn. Different
  -- barns can have facilities with the same name.
  CONSTRAINT locations_barn_facility_unique UNIQUE (barn_id, facility_name)
);

CREATE INDEX IF NOT EXISTS idx_locations_barn_id
  ON public.locations(barn_id);

CREATE INDEX IF NOT EXISTS idx_locations_barn_active
  ON public.locations(barn_id)
  WHERE archived = false;

-- ============================================================
-- 2. horse_location_assignments
-- ============================================================

CREATE TABLE IF NOT EXISTS public.horse_location_assignments (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barn_id               uuid NOT NULL REFERENCES public.barns(id) ON DELETE CASCADE,
  horse_id              uuid NOT NULL REFERENCES public.horses(id) ON DELETE CASCADE,
  location_id           uuid NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
  started_at            date NOT NULL DEFAULT current_date,
  ended_at              date,
  note                  text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  created_by_user_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  CONSTRAINT horse_location_assignments_date_order
    CHECK (ended_at IS NULL OR ended_at >= started_at)
);

-- Fast lookup for "where is horse X right now?"
CREATE INDEX IF NOT EXISTS idx_horse_location_assignments_horse
  ON public.horse_location_assignments(horse_id, ended_at);

-- Fast lookup for "which horses are at location X?"
CREATE INDEX IF NOT EXISTS idx_horse_location_assignments_location
  ON public.horse_location_assignments(location_id, ended_at);

-- A horse can only have ONE active assignment at a time.
CREATE UNIQUE INDEX IF NOT EXISTS idx_horse_location_assignments_one_active
  ON public.horse_location_assignments(horse_id)
  WHERE ended_at IS NULL;

-- ============================================================
-- 3. horses disposition columns
-- ============================================================

ALTER TABLE public.horses
  ADD COLUMN IF NOT EXISTS disposition text
    CHECK (disposition IS NULL OR disposition IN ('sold', 'died', 'retired'));

ALTER TABLE public.horses
  ADD COLUMN IF NOT EXISTS disposition_date date;

ALTER TABLE public.horses
  ADD COLUMN IF NOT EXISTS disposition_notes text;

ALTER TABLE public.horses
  ADD COLUMN IF NOT EXISTS disposition_sold_to text;

ALTER TABLE public.horses
  ADD COLUMN IF NOT EXISTS disposition_sale_price numeric(12, 2);

-- Fast filter for "show me active horses" / "show me dispositioned horses"
CREATE INDEX IF NOT EXISTS idx_horses_disposition
  ON public.horses(barn_id, disposition)
  WHERE disposition IS NOT NULL;

-- ============================================================
-- 4. horse_current_location view
-- ============================================================
--
-- Read-only join that pairs each horse with its active location
-- assignment (if any). Security is inherited from the underlying
-- tables via security_invoker = true (Postgres 15+).
--
-- Usage: SELECT * FROM horse_current_location WHERE horse_id = $1

CREATE OR REPLACE VIEW public.horse_current_location
WITH (security_invoker = true) AS
SELECT
  h.id                                    AS horse_id,
  h.barn_id                               AS barn_id,
  hla.id                                  AS assignment_id,
  hla.location_id                         AS location_id,
  l.facility_name                         AS facility_name,
  l.address_line_1                        AS address_line_1,
  l.address_line_2                        AS address_line_2,
  l.city                                  AS city,
  l.state_province                        AS state_province,
  l.postal_code                           AS postal_code,
  l.country                               AS country,
  hla.note                                AS assignment_note,
  hla.started_at                          AS started_at
FROM public.horses h
LEFT JOIN public.horse_location_assignments hla
  ON hla.horse_id = h.id
 AND hla.ended_at IS NULL
LEFT JOIN public.locations l
  ON l.id = hla.location_id;

-- ============================================================
-- 5. Atomic RPCs
-- ============================================================

-- ------------------------------------------------------------
-- move_horse_to_location
-- ------------------------------------------------------------
--
-- Moves a horse to a new location in one atomic operation:
--   1. If p_location_input is {id: uuid}, resolve to that location.
--   2. Otherwise, create a new location with the provided facility
--      fields and use that id.
--   3. Close out any current (ended_at IS NULL) assignment for this
--      horse by setting ended_at to p_started_at.
--   4. Insert a new assignment with ended_at = NULL.
--
-- Returns a jsonb object with the assignment id, location id, and a
-- boolean flag indicating whether a new location was created.
--
-- Scope: this RPC is the only way to update a horse's current location
-- from the app. Direct INSERT/UPDATE against horse_location_assignments
-- is blocked by RLS update-via-function pattern (the table policies
-- allow direct writes as well, for admin / migration flexibility, but
-- the app always goes through this function).

CREATE OR REPLACE FUNCTION public.move_horse_to_location(
  p_horse_id          uuid,
  p_location_input    jsonb,
  p_assignment_note   text DEFAULT NULL,
  p_started_at        date DEFAULT current_date,
  p_created_by        uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_barn_id            uuid;
  v_location_id        uuid;
  v_assignment_id      uuid;
  v_created_location   boolean := false;
BEGIN
  IF p_horse_id IS NULL THEN
    RAISE EXCEPTION 'p_horse_id is required';
  END IF;

  IF p_location_input IS NULL THEN
    RAISE EXCEPTION 'p_location_input is required';
  END IF;

  -- Resolve the horse's barn_id so we can tag assignments correctly
  -- and so new locations get created in the right barn.
  SELECT barn_id INTO v_barn_id
    FROM public.horses
   WHERE id = p_horse_id;

  IF v_barn_id IS NULL THEN
    RAISE EXCEPTION 'horse % not found', p_horse_id;
  END IF;

  -- Pick existing vs create new
  IF p_location_input ? 'id' THEN
    v_location_id := (p_location_input->>'id')::uuid;

    -- Guardrail: the chosen location must belong to the same barn.
    PERFORM 1
       FROM public.locations
      WHERE id = v_location_id
        AND barn_id = v_barn_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'location % does not belong to barn %', v_location_id, v_barn_id;
    END IF;
  ELSE
    -- Create a new location from the jsonb fields.
    IF (p_location_input->>'facility_name') IS NULL OR
       length(trim(p_location_input->>'facility_name')) = 0 THEN
      RAISE EXCEPTION 'facility_name is required when creating a new location';
    END IF;

    INSERT INTO public.locations (
      barn_id,
      facility_name,
      address_line_1,
      address_line_2,
      city,
      state_province,
      postal_code,
      country,
      notes,
      created_by_user_id
    )
    VALUES (
      v_barn_id,
      trim(p_location_input->>'facility_name'),
      NULLIF(trim(coalesce(p_location_input->>'address_line_1', '')), ''),
      NULLIF(trim(coalesce(p_location_input->>'address_line_2', '')), ''),
      NULLIF(trim(coalesce(p_location_input->>'city', '')), ''),
      NULLIF(trim(coalesce(p_location_input->>'state_province', '')), ''),
      NULLIF(trim(coalesce(p_location_input->>'postal_code', '')), ''),
      NULLIF(trim(coalesce(p_location_input->>'country', '')), ''),
      NULLIF(trim(coalesce(p_location_input->>'notes', '')), ''),
      p_created_by
    )
    RETURNING id INTO v_location_id;

    v_created_location := true;
  END IF;

  -- Close out any current assignment(s) for this horse. There should
  -- only ever be one thanks to the partial unique index, but we use a
  -- set-based update to be safe.
  UPDATE public.horse_location_assignments
     SET ended_at = p_started_at
   WHERE horse_id = p_horse_id
     AND ended_at IS NULL;

  -- Insert the new active assignment.
  INSERT INTO public.horse_location_assignments (
    barn_id,
    horse_id,
    location_id,
    started_at,
    ended_at,
    note,
    created_by_user_id
  )
  VALUES (
    v_barn_id,
    p_horse_id,
    v_location_id,
    p_started_at,
    NULL,
    NULLIF(trim(coalesce(p_assignment_note, '')), ''),
    p_created_by
  )
  RETURNING id INTO v_assignment_id;

  RETURN jsonb_build_object(
    'assignment_id',    v_assignment_id,
    'location_id',      v_location_id,
    'created_location', v_created_location
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.move_horse_to_location(uuid, jsonb, text, date, uuid) TO authenticated;

-- ------------------------------------------------------------
-- record_horse_disposition
-- ------------------------------------------------------------
--
-- Marks a horse as sold / died / retired and archives her. Closes out
-- any active location assignment. All in one transaction.
--
-- Notes:
--   * Setting disposition = 'retired' here records "retired from
--     program" — different from reproductive_status = 'retired' which
--     is about breeding cycle state. They can co-exist but the
--     disposition field is the canonical "she's done" signal.
--   * For disposition = 'sold', p_sold_to and p_sale_price are
--     captured. For 'died', p_cause_of_death goes in p_notes.
--   * archived is set to true so she disappears from active pickers.
--
-- Returns a jsonb object with the final disposition + archived flag.

CREATE OR REPLACE FUNCTION public.record_horse_disposition(
  p_horse_id          uuid,
  p_disposition       text,
  p_disposition_date  date DEFAULT current_date,
  p_notes             text DEFAULT NULL,
  p_sold_to           text DEFAULT NULL,
  p_sale_price        numeric DEFAULT NULL,
  p_created_by        uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_barn_id uuid;
BEGIN
  IF p_horse_id IS NULL THEN
    RAISE EXCEPTION 'p_horse_id is required';
  END IF;

  IF p_disposition IS NULL OR p_disposition NOT IN ('sold', 'died', 'retired') THEN
    RAISE EXCEPTION 'p_disposition must be one of: sold, died, retired';
  END IF;

  SELECT barn_id INTO v_barn_id
    FROM public.horses
   WHERE id = p_horse_id;

  IF v_barn_id IS NULL THEN
    RAISE EXCEPTION 'horse % not found', p_horse_id;
  END IF;

  -- Close out any active location assignment. The horse is leaving
  -- the program, so she isn't at any location anymore.
  UPDATE public.horse_location_assignments
     SET ended_at = p_disposition_date
   WHERE horse_id = p_horse_id
     AND ended_at IS NULL;

  -- Update the horse record.
  UPDATE public.horses
     SET disposition           = p_disposition,
         disposition_date      = p_disposition_date,
         disposition_notes     = NULLIF(trim(coalesce(p_notes, '')), ''),
         disposition_sold_to   = CASE WHEN p_disposition = 'sold'
                                      THEN NULLIF(trim(coalesce(p_sold_to, '')), '')
                                      ELSE NULL END,
         disposition_sale_price = CASE WHEN p_disposition = 'sold'
                                       THEN p_sale_price
                                       ELSE NULL END,
         archived              = true,
         updated_at            = now()
   WHERE id = p_horse_id;

  RETURN jsonb_build_object(
    'horse_id',         p_horse_id,
    'disposition',      p_disposition,
    'disposition_date', p_disposition_date,
    'archived',         true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_horse_disposition(uuid, text, date, text, text, numeric, uuid) TO authenticated;

-- ------------------------------------------------------------
-- unarchive_horse
-- ------------------------------------------------------------
--
-- Reverses a disposition. Clears disposition fields, un-archives the
-- horse. Does NOT restore the prior location assignment — the user
-- must run move_horse_to_location separately to place her somewhere.

CREATE OR REPLACE FUNCTION public.unarchive_horse(
  p_horse_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_horse_id IS NULL THEN
    RAISE EXCEPTION 'p_horse_id is required';
  END IF;

  UPDATE public.horses
     SET disposition            = NULL,
         disposition_date       = NULL,
         disposition_notes      = NULL,
         disposition_sold_to    = NULL,
         disposition_sale_price = NULL,
         archived               = false,
         updated_at             = now()
   WHERE id = p_horse_id;

  RETURN jsonb_build_object(
    'horse_id', p_horse_id,
    'archived', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.unarchive_horse(uuid) TO authenticated;

-- ============================================================
-- 6. RLS policies
-- ============================================================

-- locations
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "locations_select" ON public.locations
  FOR SELECT TO authenticated
  USING (is_barn_member(barn_id) OR is_barn_owner(barn_id));

CREATE POLICY "locations_insert" ON public.locations
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "locations_update" ON public.locations
  FOR UPDATE TO authenticated
  USING (is_barn_member(barn_id) OR is_barn_owner(barn_id));

-- horse_location_assignments
ALTER TABLE public.horse_location_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "horse_location_assignments_select" ON public.horse_location_assignments
  FOR SELECT TO authenticated
  USING (is_barn_member(barn_id) OR is_barn_owner(barn_id));

CREATE POLICY "horse_location_assignments_insert" ON public.horse_location_assignments
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "horse_location_assignments_update" ON public.horse_location_assignments
  FOR UPDATE TO authenticated
  USING (is_barn_member(barn_id) OR is_barn_owner(barn_id));

COMMIT;
