-- ==========================================================================
-- Business Pro — account-level add-on for financial tracking
-- ==========================================================================
-- Adds:
--   1. has_business_pro flag on profiles (+ admin metadata columns)
--   2. Financial columns on activity_log and health_records
--   3. Indexes for the dashboard aggregation queries
--
-- Scope rules:
--   * All new columns are NULLABLE — zero impact on existing rows.
--   * No RLS changes — existing row-level policies cover the new columns.
--   * Idempotent (uses IF NOT EXISTS throughout).
-- ==========================================================================

-- ── 1. Profile flag ────────────────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS has_business_pro boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS business_pro_enabled_at timestamptz,
  ADD COLUMN IF NOT EXISTS business_pro_enabled_by uuid REFERENCES auth.users(id);


-- ── 2. activity_log financial columns ──────────────────────────────────────
ALTER TABLE activity_log
  ADD COLUMN IF NOT EXISTS cost_type text,
  ADD COLUMN IF NOT EXISTS billable_to_user_id uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS billable_to_name text,
  ADD COLUMN IF NOT EXISTS payment_status text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_amount numeric;

-- Constraints (use DO blocks so they're idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_activity_log_cost_type') THEN
    ALTER TABLE activity_log ADD CONSTRAINT chk_activity_log_cost_type
      CHECK (cost_type IS NULL OR cost_type IN ('expense', 'revenue', 'pass_through'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_activity_log_payment_status') THEN
    ALTER TABLE activity_log ADD CONSTRAINT chk_activity_log_payment_status
      CHECK (payment_status IS NULL OR payment_status IN ('unpaid', 'paid', 'partial', 'waived'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_activity_log_cost_type_performed_at
  ON activity_log(cost_type, performed_at)
  WHERE cost_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activity_log_billable_to_payment
  ON activity_log(billable_to_user_id, payment_status)
  WHERE billable_to_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activity_log_payment_status_performed
  ON activity_log(payment_status, performed_at)
  WHERE payment_status IS NOT NULL;


-- ── 3. health_records financial columns ────────────────────────────────────
ALTER TABLE health_records
  ADD COLUMN IF NOT EXISTS cost_type text,
  ADD COLUMN IF NOT EXISTS billable_to_user_id uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS billable_to_name text,
  ADD COLUMN IF NOT EXISTS payment_status text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_amount numeric;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_health_records_cost_type') THEN
    ALTER TABLE health_records ADD CONSTRAINT chk_health_records_cost_type
      CHECK (cost_type IS NULL OR cost_type IN ('expense', 'revenue', 'pass_through'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_health_records_payment_status') THEN
    ALTER TABLE health_records ADD CONSTRAINT chk_health_records_payment_status
      CHECK (payment_status IS NULL OR payment_status IN ('unpaid', 'paid', 'partial', 'waived'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_health_records_cost_type_performed_at
  ON health_records(cost_type, performed_at)
  WHERE cost_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_health_records_billable_to_payment
  ON health_records(billable_to_user_id, payment_status)
  WHERE billable_to_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_health_records_payment_status_performed
  ON health_records(payment_status, performed_at)
  WHERE payment_status IS NOT NULL;
