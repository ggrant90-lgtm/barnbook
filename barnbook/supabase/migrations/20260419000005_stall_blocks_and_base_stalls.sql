-- ==========================================================================
-- Build-A-Barn: stall-block flags + base_stalls rename + RLS tightening
-- ==========================================================================
-- The barn_stall_blocks table was already scaffolded in staging-schema.sql
-- but never wired up. This migration finishes it:
--
--   1. Adds is_free_promo flag so we can identify early-access-comped
--      blocks when billing flips on later.
--   2. Renames barns.stall_capacity -> barns.base_stalls. "Total capacity"
--      is now computed as base_stalls + SUM(active barn_stall_blocks).
--      One source of truth; no denormalized stall_capacity to drift.
--   3. Replaces the permissive staging RLS policy on barn_stall_blocks
--      (auth.uid() IS NOT NULL) with owner/member-scoped policies.
--      Subqueries are inlined rather than calling is_barn_owner() /
--      is_barn_member() helpers — same defensive pattern as
--      20260419000003_horse_documents_rls_fix.sql so this path can't
--      break if the helpers' EXECUTE grants regress again.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS, rename guarded by a DO block,
-- DROP POLICY IF EXISTS + CREATE for every policy.
-- ==========================================================================


-- ── 1. is_free_promo flag ──────────────────────────────────────────────────
ALTER TABLE public.barn_stall_blocks
  ADD COLUMN IF NOT EXISTS is_free_promo boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_barn_stall_blocks_free_promo
  ON public.barn_stall_blocks(barn_id)
  WHERE is_free_promo = true AND status = 'active';


-- ── 2. barns.stall_capacity -> barns.base_stalls ──────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'barns'
      AND column_name  = 'stall_capacity'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'barns'
      AND column_name  = 'base_stalls'
  ) THEN
    ALTER TABLE public.barns RENAME COLUMN stall_capacity TO base_stalls;
  END IF;
END $$;

-- Ensure the column exists either way (fresh installs + legacy ones).
ALTER TABLE public.barns
  ADD COLUMN IF NOT EXISTS base_stalls integer NOT NULL DEFAULT 5;

ALTER TABLE public.barns
  ALTER COLUMN base_stalls SET DEFAULT 5;


-- ── 3. Tightened RLS on barn_stall_blocks ─────────────────────────────────
-- Drop the old permissive policy (any authenticated user could read any
-- barn's blocks).
DROP POLICY IF EXISTS "Authenticated users can view stall blocks"
  ON public.barn_stall_blocks;

-- SELECT: barn owner or active member only.
DROP POLICY IF EXISTS barn_stall_blocks_select ON public.barn_stall_blocks;
CREATE POLICY barn_stall_blocks_select ON public.barn_stall_blocks
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.barns b
      WHERE b.id = barn_stall_blocks.barn_id
        AND b.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.barn_members bm
      WHERE bm.barn_id = barn_stall_blocks.barn_id
        AND bm.user_id = auth.uid()
    )
  );

-- INSERT: barn owner only.
DROP POLICY IF EXISTS barn_stall_blocks_insert ON public.barn_stall_blocks;
CREATE POLICY barn_stall_blocks_insert ON public.barn_stall_blocks
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.barns b
      WHERE b.id = barn_stall_blocks.barn_id
        AND b.owner_id = auth.uid()
    )
  );

-- UPDATE: barn owner only (e.g. cancelling a block).
DROP POLICY IF EXISTS barn_stall_blocks_update ON public.barn_stall_blocks;
CREATE POLICY barn_stall_blocks_update ON public.barn_stall_blocks
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.barns b
      WHERE b.id = barn_stall_blocks.barn_id
        AND b.owner_id = auth.uid()
    )
  );
