-- ==========================================================================
-- Fix: horses INSERT RLS was inconsistent with Phase A's owner-only UPDATE.
-- ==========================================================================
-- Phase A tightened `horses` UPDATE to `is_barn_owner(barn_id)` to enforce
-- the spec's "horse profile edits are owner-only" rule. The INSERT policy
-- was left with its original allow-list of owner/manager/trainer roles,
-- which (a) is inconsistent with UPDATE — someone who can create a horse
-- but can't then edit it doesn't make sense — and (b) didn't include the
-- `editor` role that the app-side `canUserEditHorse` admits, causing a
-- "new row violates row-level security policy" error when a non-owner
-- editor tried to create a horse.
--
-- Fix: align with UPDATE — horse creation is owner-only. Managers and
-- trainers who need to add horses go through the barn owner.
-- ==========================================================================

DROP POLICY IF EXISTS "Barn editors can insert horses" ON public.horses;

CREATE POLICY horses_insert ON public.horses
  FOR INSERT TO authenticated
  WITH CHECK (is_barn_owner(barn_id));
