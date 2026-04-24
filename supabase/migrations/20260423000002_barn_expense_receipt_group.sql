-- ==========================================================================
-- Barn Expenses — receipt_group_id for split receipts
-- ==========================================================================
-- When a single receipt covers multiple categories (feed + wormer at
-- the same place) the review flow now creates N barn_expenses rows —
-- one per category group — all pointing at the same receipt image.
-- `receipt_group_id` ties them together so the Receipts bin can
-- coalesce them back into a single "scan event" for display.
--
-- Nullable. A null value means "single-row receipt" (the common case
-- for both historical rows and un-split new scans), which is
-- indistinguishable from pre-migration rows.
-- ==========================================================================

ALTER TABLE public.barn_expenses
  ADD COLUMN IF NOT EXISTS receipt_group_id uuid;

-- Partial index: only rows that are part of a group end up indexed.
CREATE INDEX IF NOT EXISTS idx_barn_expenses_receipt_group
  ON public.barn_expenses (receipt_group_id)
  WHERE receipt_group_id IS NOT NULL;
