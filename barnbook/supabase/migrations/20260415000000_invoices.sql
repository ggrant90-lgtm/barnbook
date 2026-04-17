-- ==========================================================================
-- Business Pro — Invoicing
-- ==========================================================================
-- Adds:
--   1. invoices table (barn-scoped, RLS enabled, all 4 policies)
--   2. invoice_id columns on activity_log + health_records (link entries
--      to invoices; ON DELETE SET NULL preserves entries if invoice is deleted)
--   3. Invoice branding columns on barns (logo_url, company_name, address,
--      phone, email, default notes) — used as defaults when creating
--      invoices; each invoice snapshots its own copy at send time so editing
--      barn branding later never mutates historical invoices.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS.
-- ==========================================================================

-- ── 1. invoices table ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invoices (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barn_id           uuid NOT NULL REFERENCES public.barns(id) ON DELETE CASCADE,
  invoice_number    text NOT NULL,
  -- Client (dual pattern matching billable_to fields)
  billable_to_user_id uuid REFERENCES public.profiles(id),
  billable_to_name    text,
  -- Dates
  issue_date        date NOT NULL DEFAULT CURRENT_DATE,
  due_date          date,
  -- Status lifecycle
  status            text NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'void', 'partial')),
  -- Money (subtotal computed from linked entries but cached for perf)
  subtotal          numeric NOT NULL DEFAULT 0,
  paid_amount       numeric NOT NULL DEFAULT 0,
  paid_at           timestamptz,
  -- Content
  notes             text,
  terms             text,
  -- Branding snapshot (frozen at send time so editing barn settings later
  -- does NOT change past invoices)
  logo_url          text,
  company_name      text,
  company_address   text,
  company_phone     text,
  company_email     text,
  -- Metadata
  created_by_user_id uuid REFERENCES auth.users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz,
  sent_at           timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_number_per_barn
  ON public.invoices(barn_id, invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_barn_status
  ON public.invoices(barn_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_billable_to_user
  ON public.invoices(billable_to_user_id) WHERE billable_to_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_due_date
  ON public.invoices(due_date) WHERE status IN ('sent', 'partial', 'overdue');

-- RLS — barn-scoped, all four policies (SECURITY DEFINER helpers used)
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'invoices_select') THEN
    CREATE POLICY invoices_select ON public.invoices
      FOR SELECT TO authenticated
      USING (is_barn_member(barn_id) OR is_barn_owner(barn_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'invoices_insert') THEN
    CREATE POLICY invoices_insert ON public.invoices
      FOR INSERT TO authenticated
      WITH CHECK (is_barn_owner(barn_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'invoices_update') THEN
    CREATE POLICY invoices_update ON public.invoices
      FOR UPDATE TO authenticated
      USING (is_barn_owner(barn_id) OR is_barn_member(barn_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'invoices_delete') THEN
    CREATE POLICY invoices_delete ON public.invoices
      FOR DELETE TO authenticated
      USING (is_barn_owner(barn_id));
  END IF;
END $$;


-- ── 2. invoice_id on activity_log + health_records ─────────────────────────
ALTER TABLE public.activity_log
  ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL;
ALTER TABLE public.health_records
  ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_activity_log_invoice
  ON public.activity_log(invoice_id) WHERE invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_health_records_invoice
  ON public.health_records(invoice_id) WHERE invoice_id IS NOT NULL;


-- ── 3. Barn invoice branding (defaults) ────────────────────────────────────
-- Note: logo_url already exists on barns (from the public profile feature)
-- We reuse it here for invoice branding.
ALTER TABLE public.barns
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS company_address text,
  ADD COLUMN IF NOT EXISTS company_phone text,
  ADD COLUMN IF NOT EXISTS company_email text,
  ADD COLUMN IF NOT EXISTS invoice_notes_default text,
  ADD COLUMN IF NOT EXISTS invoice_terms_default text,
  ADD COLUMN IF NOT EXISTS next_invoice_seq integer NOT NULL DEFAULT 1;
