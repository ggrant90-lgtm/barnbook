-- ==========================================================================
-- Scheduled entries: planned vs completed log rows
-- ==========================================================================
-- Adds a `status` column to activity_log and health_records so a single
-- row can represent either a completed log entry (the historical norm)
-- or a planned/scheduled entry in the future that hasn't happened yet.
--
-- Why it lives on the same table instead of a separate one:
--   - "Mark done" becomes a one-field UPDATE with zero data migration.
--   - Calendar, horse activity, and Business Pro rollups already query
--     these two tables — filtering on `status` is one extra predicate,
--     vs. UNION-ing a new table everywhere.
--   - Backdating already works (the log forms accept any date) — this
--     change only formalizes the "planned" direction.
--
-- Zero risk to existing data:
--   - Both columns default to 'completed', so every existing row carries
--     the correct status from the moment the migration runs.
--   - Check constraints are added only if they don't already exist.
--   - Indexes include the status in the key so planned-scoped queries
--     (dashboard "Upcoming" strip, calendar `scheduled` filter) stay
--     cheap without touching the common completed-only path.
-- ==========================================================================


-- ── 1. activity_log.status ────────────────────────────────────────────────
ALTER TABLE public.activity_log
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'activity_log_status_check'
      AND conrelid = 'public.activity_log'::regclass
  ) THEN
    ALTER TABLE public.activity_log
      ADD CONSTRAINT activity_log_status_check
      CHECK (status IN ('planned', 'completed'));
  END IF;
END $$;


-- ── 2. health_records.status ──────────────────────────────────────────────
ALTER TABLE public.health_records
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'health_records_status_check'
      AND conrelid = 'public.health_records'::regclass
  ) THEN
    ALTER TABLE public.health_records
      ADD CONSTRAINT health_records_status_check
      CHECK (status IN ('planned', 'completed'));
  END IF;
END $$;


-- ── 3. Indexes for planned-scoped reads ───────────────────────────────────
-- Composite keys: (horse_id, status, date). Dashboard "Upcoming" + the
-- calendar's `scheduled` filter hit this index directly; the common
-- completed-only horse-activity query still uses the existing horse_id
-- index on these tables without regression.
CREATE INDEX IF NOT EXISTS idx_activity_log_horse_status_performed
  ON public.activity_log (horse_id, status, performed_at);

CREATE INDEX IF NOT EXISTS idx_health_records_horse_status_date
  ON public.health_records (horse_id, status, record_date);
