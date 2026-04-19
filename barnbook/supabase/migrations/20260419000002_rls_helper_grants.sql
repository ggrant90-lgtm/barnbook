-- ==========================================================================
-- Re-grant EXECUTE on RLS helper functions + inline horses_insert check.
-- ==========================================================================
-- Multiple users hit "new row violates row-level security policy for
-- table 'horses'" when trying to create a horse, even while signed in
-- as the barn owner. The is_barn_owner function body is correct, so the
-- most likely cause is that `authenticated` lost EXECUTE privilege on
-- the SECURITY DEFINER helpers — when an RLS policy calls a function the
-- current role can't execute, the check fails and the row is rejected.
--
-- Fix:
--   1. Re-GRANT EXECUTE on every helper used by RLS policies, to both
--      `authenticated` and `anon` where relevant.
--   2. Replace the horses_insert policy with an inline ownership check
--      that doesn't depend on any function call — belt-and-suspenders so
--      this specific path can't break again regardless of function state.
--
-- Idempotent: GRANT is no-op if already granted, DROP IF EXISTS + CREATE
-- for the policy.
-- ==========================================================================

-- ── 1. Grants on helper functions ───────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.is_barn_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_barn_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_access_horse(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_log_entry(uuid, uuid, text) TO authenticated;


-- ── 2. Inline the ownership check on horses_insert ──────────────────────
-- This is functionally identical to `is_barn_owner(barn_id)` but doesn't
-- route through a function — the INSERT path will work even if something
-- about the helper's grants regresses again.
DROP POLICY IF EXISTS horses_insert ON public.horses;

CREATE POLICY horses_insert ON public.horses
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.barns
      WHERE id = barn_id AND owner_id = auth.uid()
    )
  );
