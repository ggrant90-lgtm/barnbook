-- ==========================================================================
-- Business Pro — Invoice Line Items
-- ==========================================================================
-- Custom line items on invoices (separate from log entries).
-- Used for: monthly board, training packages, adjustments, tax, etc.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS.
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.invoice_line_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id    uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description   text NOT NULL,
  quantity      numeric NOT NULL DEFAULT 1,
  unit_price    numeric NOT NULL DEFAULT 0,
  amount        numeric NOT NULL DEFAULT 0,
  -- Optional link to a horse for context (e.g., "Board for Bella")
  horse_id      uuid REFERENCES public.horses(id) ON DELETE SET NULL,
  sort_order    integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice
  ON public.invoice_line_items(invoice_id);

-- RLS — piggyback on invoice access (line items inherit invoice's barn)
ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'invoice_line_items_select') THEN
    CREATE POLICY invoice_line_items_select ON public.invoice_line_items
      FOR SELECT TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.invoices i
        WHERE i.id = invoice_line_items.invoice_id
          AND (is_barn_member(i.barn_id) OR is_barn_owner(i.barn_id))
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'invoice_line_items_insert') THEN
    CREATE POLICY invoice_line_items_insert ON public.invoice_line_items
      FOR INSERT TO authenticated
      WITH CHECK (EXISTS (
        SELECT 1 FROM public.invoices i
        WHERE i.id = invoice_line_items.invoice_id
          AND is_barn_owner(i.barn_id)
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'invoice_line_items_update') THEN
    CREATE POLICY invoice_line_items_update ON public.invoice_line_items
      FOR UPDATE TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.invoices i
        WHERE i.id = invoice_line_items.invoice_id
          AND is_barn_owner(i.barn_id)
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'invoice_line_items_delete') THEN
    CREATE POLICY invoice_line_items_delete ON public.invoice_line_items
      FOR DELETE TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.invoices i
        WHERE i.id = invoice_line_items.invoice_id
          AND is_barn_owner(i.barn_id)
      ));
  END IF;
END $$;
