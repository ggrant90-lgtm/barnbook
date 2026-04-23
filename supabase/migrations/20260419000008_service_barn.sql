-- ==========================================================================
-- Service Barn: barn_type='service' + quick records + linked horses
-- ==========================================================================
-- Adds a new barn_type for mobile service providers (farriers, vets,
-- dentists, body workers, exercise riders).
--
-- Two kinds of horses live in a Service Barn:
--   1. Quick records — real rows in horses with is_quick_record=true,
--      most profile fields null, plus four contact/location columns.
--      They exist purely for log entries + billing. No RLS changes
--      needed — the existing horses policies cover them because the
--      Service Barn owner owns the barn_id.
--   2. Linked horses — references into horses at OTHER barns the user
--      holds a Stall Key for. Stored in the new service_barn_links
--      table.
--
-- Zero risk to existing data: all additions are additive with defaults,
-- RLS on service_barn_links uses inline subqueries (per migrations
-- 20260419000003/5/6 pattern) so it doesn't depend on helpers.
-- ==========================================================================


-- ── 1. barns.barn_type accepts 'service' ──────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'barns_barn_type_check' AND conrelid = 'public.barns'::regclass
  ) THEN
    ALTER TABLE public.barns DROP CONSTRAINT barns_barn_type_check;
  END IF;
  ALTER TABLE public.barns
    ADD CONSTRAINT barns_barn_type_check
    CHECK (barn_type IN ('standard', 'mare_motel', 'service'));
END $$;


-- ── 2. horses: quick-record flag + contact/location columns ───────────────
ALTER TABLE public.horses
  ADD COLUMN IF NOT EXISTS is_quick_record      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS owner_contact_name   text,
  ADD COLUMN IF NOT EXISTS owner_contact_phone  text,
  ADD COLUMN IF NOT EXISTS owner_contact_email  text,
  ADD COLUMN IF NOT EXISTS location_name        text;

-- Partial index speeds up the Service Barn dashboard's "give me all
-- quick records in this barn" query.
CREATE INDEX IF NOT EXISTS idx_horses_quick_record
  ON public.horses(barn_id)
  WHERE is_quick_record = true;


-- ── 3. service_barn_links join table ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.service_barn_links (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_barn_id    uuid NOT NULL REFERENCES public.barns(id)    ON DELETE CASCADE,
  horse_id           uuid NOT NULL REFERENCES public.horses(id)   ON DELETE CASCADE,
  linked_by_user_id  uuid NOT NULL REFERENCES public.profiles(id),
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE(service_barn_id, horse_id)
);

CREATE INDEX IF NOT EXISTS idx_service_barn_links_service_barn
  ON public.service_barn_links(service_barn_id);
CREATE INDEX IF NOT EXISTS idx_service_barn_links_horse
  ON public.service_barn_links(horse_id);

ALTER TABLE public.service_barn_links ENABLE ROW LEVEL SECURITY;

-- Policies use inline subqueries so they don't depend on is_barn_owner /
-- user_can_access_horse SECURITY DEFINER helpers that have flaked in
-- server-action contexts (see migration 20260419000003 notes).

DROP POLICY IF EXISTS service_barn_links_select ON public.service_barn_links;
CREATE POLICY service_barn_links_select ON public.service_barn_links
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.barns b
      WHERE b.id = service_barn_links.service_barn_id
        AND b.owner_id = auth.uid()
    )
  );

-- INSERT: must own the Service Barn AND have access to the horse
-- (either barn-owned or via a stall-key access row).
DROP POLICY IF EXISTS service_barn_links_insert ON public.service_barn_links;
CREATE POLICY service_barn_links_insert ON public.service_barn_links
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.barns b
      WHERE b.id = service_barn_links.service_barn_id
        AND b.owner_id = auth.uid()
        AND b.barn_type = 'service'
    )
    AND (
      EXISTS (
        SELECT 1 FROM public.horses h
        JOIN public.barns hb ON hb.id = h.barn_id
        WHERE h.id = service_barn_links.horse_id
          AND hb.owner_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.user_horse_access uha
        WHERE uha.horse_id = service_barn_links.horse_id
          AND uha.user_id  = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS service_barn_links_delete ON public.service_barn_links;
CREATE POLICY service_barn_links_delete ON public.service_barn_links
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.barns b
      WHERE b.id = service_barn_links.service_barn_id
        AND b.owner_id = auth.uid()
    )
  );
