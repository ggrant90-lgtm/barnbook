-- ==========================================================================
-- Per-horse display-name preference.
-- ==========================================================================
-- Users asked to be able to choose whether a horse's registered / papered
-- name or its barn name is the primary display name across the app
-- (profile header, horse cards, dashboard). Stored per-horse; default
-- 'papered' so existing rows behave exactly as before.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS, DROP + re-add CHECK via DO block.
-- ==========================================================================

ALTER TABLE public.horses
  ADD COLUMN IF NOT EXISTS primary_name_pref text NOT NULL DEFAULT 'papered';

-- Add the CHECK constraint if it isn't already present.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'horses_primary_name_pref_check'
      AND conrelid = 'public.horses'::regclass
  ) THEN
    ALTER TABLE public.horses
      ADD CONSTRAINT horses_primary_name_pref_check
      CHECK (primary_name_pref IN ('papered', 'barn'));
  END IF;
END $$;
