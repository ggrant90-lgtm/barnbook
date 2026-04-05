-- Mare Motel Scaffolding Migration
-- Feature 1: barn_type column
-- Feature 2: horse_stays table
-- Feature 3: breed_data log type + drillable history columns
-- Log media: log_media table + storage bucket

-- ============================================================
-- Feature 1: Add barn_type to barns
-- ============================================================
ALTER TABLE public.barns
  ADD COLUMN IF NOT EXISTS barn_type text NOT NULL DEFAULT 'standard';

-- ============================================================
-- Feature 2: horse_stays table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.horse_stays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  horse_id uuid NOT NULL REFERENCES public.horses(id) ON DELETE CASCADE,
  home_barn_id uuid NOT NULL REFERENCES public.barns(id) ON DELETE CASCADE,
  host_barn_id uuid NOT NULL REFERENCES public.barns(id) ON DELETE CASCADE,
  start_date timestamptz NOT NULL DEFAULT now(),
  end_date timestamptz,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_by_user_id uuid REFERENCES public.profiles(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_horse_stays_horse ON public.horse_stays(horse_id);
CREATE INDEX IF NOT EXISTS idx_horse_stays_home ON public.horse_stays(home_barn_id);
CREATE INDEX IF NOT EXISTS idx_horse_stays_host ON public.horse_stays(host_barn_id);
CREATE INDEX IF NOT EXISTS idx_horse_stays_status ON public.horse_stays(status);

-- Security definer function: can user access horse (home barn OR active stay host barn)
CREATE OR REPLACE FUNCTION public.user_can_access_horse(p_user_id uuid, p_horse_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- User is in the horse's home barn
    SELECT 1 FROM horses h
    JOIN barn_members bm ON bm.barn_id = h.barn_id
    WHERE h.id = p_horse_id
      AND bm.user_id = p_user_id
      AND bm.status = 'active'
  )
  OR EXISTS (
    -- User owns the horse's home barn
    SELECT 1 FROM horses h
    JOIN barns b ON b.id = h.barn_id
    WHERE h.id = p_horse_id
      AND b.owner_id = p_user_id
  )
  OR EXISTS (
    -- User is in a host barn with an active stay for this horse
    SELECT 1 FROM horse_stays hs
    JOIN barn_members bm ON bm.barn_id = hs.host_barn_id
    WHERE hs.horse_id = p_horse_id
      AND hs.status = 'active'
      AND bm.user_id = p_user_id
      AND bm.status = 'active'
  )
  OR EXISTS (
    -- User owns a host barn with an active stay for this horse
    SELECT 1 FROM horse_stays hs
    JOIN barns b ON b.id = hs.host_barn_id
    WHERE hs.horse_id = p_horse_id
      AND hs.status = 'active'
      AND b.owner_id = p_user_id
  )
  OR EXISTS (
    -- User has stall-key access
    SELECT 1 FROM user_horse_access uha
    WHERE uha.horse_id = p_horse_id
      AND uha.user_id = p_user_id
  );
$$;

-- RLS for horse_stays
ALTER TABLE public.horse_stays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view stays for accessible horses"
  ON public.horse_stays FOR SELECT
  USING (
    public.user_can_access_horse(auth.uid(), horse_id)
  );

CREATE POLICY "Barn owners/managers can create stays"
  ON public.horse_stays FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND created_by_user_id = auth.uid()
  );

CREATE POLICY "Barn owners/managers can update stays"
  ON public.horse_stays FOR UPDATE
  USING (
    public.user_can_access_horse(auth.uid(), horse_id)
  );

-- ============================================================
-- Feature 3: Add provenance columns to activity_log + health_records
-- ============================================================
ALTER TABLE public.activity_log
  ADD COLUMN IF NOT EXISTS logged_at_barn_id uuid REFERENCES public.barns(id),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_by_user_id uuid REFERENCES public.profiles(id);

ALTER TABLE public.health_records
  ADD COLUMN IF NOT EXISTS logged_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS logged_at_barn_id uuid REFERENCES public.barns(id),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_by_user_id uuid REFERENCES public.profiles(id);

-- Backfill logged_at_barn_id from the horse's current barn_id
UPDATE public.activity_log al
SET logged_at_barn_id = h.barn_id
FROM public.horses h
WHERE al.horse_id = h.id
  AND al.logged_at_barn_id IS NULL;

UPDATE public.health_records hr
SET logged_at_barn_id = h.barn_id
FROM public.horses h
WHERE hr.horse_id = h.id
  AND hr.logged_at_barn_id IS NULL;

-- ============================================================
-- Log Media: table for photos + videos on log entries
-- ============================================================
CREATE TABLE IF NOT EXISTS public.log_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  log_type text NOT NULL CHECK (log_type IN ('activity', 'health')),
  log_id uuid NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('photo', 'video')),
  url text NOT NULL,
  thumbnail_url text,
  caption text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_log_media_log ON public.log_media(log_type, log_id);

ALTER TABLE public.log_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view log media"
  ON public.log_media FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert log media"
  ON public.log_media FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete log media"
  ON public.log_media FOR DELETE
  USING (auth.uid() IS NOT NULL);
