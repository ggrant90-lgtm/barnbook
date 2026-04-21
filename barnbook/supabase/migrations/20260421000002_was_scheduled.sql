-- ==========================================================================
-- was_scheduled: preserve the "this was planned ahead" history after
-- a scheduled entry gets marked done
-- ==========================================================================
-- Once markEntryCompletedAction flips status from 'planned' to
-- 'completed', the row becomes indistinguishable from an ad-hoc log
-- entry — which loses useful provenance for the provider. Did I
-- proactively schedule this shoeing and show up, or did I just log
-- it after the fact?
--
-- This column is set to true the moment scheduleEntryAction inserts
-- the row, and is never reset. It drives a small "Scheduled ✓" badge
-- in the log detail modal so completed scheduled entries stay
-- visually distinct from ad-hoc logs.
--
-- Zero risk to existing data: default false, so every pre-existing
-- row (all of which are ad-hoc anyway) correctly reads as
-- "not scheduled."
-- ==========================================================================

ALTER TABLE public.activity_log
  ADD COLUMN IF NOT EXISTS was_scheduled boolean NOT NULL DEFAULT false;

ALTER TABLE public.health_records
  ADD COLUMN IF NOT EXISTS was_scheduled boolean NOT NULL DEFAULT false;
