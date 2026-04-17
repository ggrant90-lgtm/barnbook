-- ==========================================================================
-- Business Pro — Barn-Level Expenses
-- ==========================================================================
-- Adds:
--   barn_expenses table — operating expenses that aren't tied to a specific
--   horse (rent, utilities, feed bills, insurance, farrier retainer, etc.).
--
--   Financial columns mirror activity_log / health_records so the Overview
--   dashboard can merge barn_expenses into its unified entry stream without
--   branching logic.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS, guarded policies via DO block.
-- ==========================================================================

-- ── 1. barn_expenses table ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.barn_expenses (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barn_id              uuid NOT NULL REFERENCES public.barns(id) ON DELETE CASCADE,

  -- When the expense actually happened (rent posted on the 1st, etc.)
  performed_at         timestamptz NOT NULL DEFAULT now(),

  -- Classification
  category             text NOT NULL,  -- preset or user "Other" freeform
  vendor_name          text,
  description          text,
  notes                text,
  total_cost           numeric NOT NULL DEFAULT 0,

  -- Payment tracking
  payment_method       text
                         CHECK (payment_method IN ('check','cash','card','ach','venmo','other')),
  payment_reference    text,  -- check #, card last-4, ACH trace id, etc.

  -- Financial columns mirrored from activity_log so Overview can merge uniformly.
  -- Default cost_type='expense' because that's what barn_expenses nearly
  -- always are; the CHECK allows future flexibility (e.g. a shared utility
  -- bill recorded as pass_through to split among clients).
  cost_type            text DEFAULT 'expense'
                         CHECK (cost_type IN ('expense','revenue','pass_through')),
  payment_status       text
                         CHECK (payment_status IN ('unpaid','paid','partial','waived')),
  paid_at              timestamptz,
  paid_amount          numeric,
  billable_to_user_id  uuid REFERENCES public.profiles(id),
  billable_to_name     text,
  invoice_id           uuid REFERENCES public.invoices(id) ON DELETE SET NULL,

  -- Metadata
  created_by_user_id   uuid REFERENCES auth.users(id),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_barn_expenses_barn_performed_at
  ON public.barn_expenses(barn_id, performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_barn_expenses_barn_category
  ON public.barn_expenses(barn_id, category);
CREATE INDEX IF NOT EXISTS idx_barn_expenses_barn_cost_type
  ON public.barn_expenses(barn_id, cost_type) WHERE cost_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_barn_expenses_invoice
  ON public.barn_expenses(invoice_id) WHERE invoice_id IS NOT NULL;


-- ── 2. RLS — barn-scoped, all four policies ────────────────────────────────
ALTER TABLE public.barn_expenses ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'barn_expenses_select') THEN
    CREATE POLICY barn_expenses_select ON public.barn_expenses
      FOR SELECT TO authenticated
      USING (is_barn_member(barn_id) OR is_barn_owner(barn_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'barn_expenses_insert') THEN
    CREATE POLICY barn_expenses_insert ON public.barn_expenses
      FOR INSERT TO authenticated
      WITH CHECK (is_barn_owner(barn_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'barn_expenses_update') THEN
    CREATE POLICY barn_expenses_update ON public.barn_expenses
      FOR UPDATE TO authenticated
      USING (is_barn_owner(barn_id) OR is_barn_member(barn_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'barn_expenses_delete') THEN
    CREATE POLICY barn_expenses_delete ON public.barn_expenses
      FOR DELETE TO authenticated
      USING (is_barn_owner(barn_id));
  END IF;
END $$;
