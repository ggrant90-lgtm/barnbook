-- ==========================================================================
-- Onboarding wizard state + invoice service presets.
-- ==========================================================================
-- Adds:
--   1. Five columns on profiles to track per-wizard completion + a
--      resumable step index for the Core wizard + a "dismissed forever"
--      timestamp so users who close the Core wizard don't get nagged.
--   2. One jsonb column on barns holding invoice line-item presets saved
--      by the Business Pro wizard step 2 ("what do you charge for?").
--
-- Idempotent: ADD COLUMN IF NOT EXISTS. Defaults are set so existing
-- rows get correct values without a data migration.
-- ==========================================================================

-- ── profiles: per-wizard completion + Core resumption ─────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_core_completed         boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_business_pro_completed boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_breeders_pro_completed boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_core_dismissed_at      timestamptz,
  ADD COLUMN IF NOT EXISTS onboarding_core_step              integer     NOT NULL DEFAULT 1;

-- ── barns: service presets for the invoice line-item picker ───────────────
-- Shape is intentionally simple JSON: [{ "label": "Monthly board",
-- "priceCents": 50000 }, ...]. Saved once during the BP wizard; can be
-- edited later via the Business Pro settings UI (future work).
ALTER TABLE public.barns
  ADD COLUMN IF NOT EXISTS invoice_service_presets jsonb NOT NULL DEFAULT '[]'::jsonb;
