-- ==========================================================================
-- Barn Expenses — attached receipt image + extraction payload
-- ==========================================================================
-- Adds four nullable columns to `barn_expenses` so a scanned receipt's
-- image + mime type + original filename can travel alongside each
-- expense row. The raw LLM extraction result is also kept as JSONB so
-- the schema can evolve without further migrations.
--
-- Storage itself reuses the existing `horse-documents` bucket under a
-- `{barn_id}/receipts/` path prefix — no new bucket, no new storage
-- policies needed.
--
-- Zero risk to existing rows: all four columns default to NULL. The
-- "only BP users can view the image" policy is a UI gate on the
-- detail page, not an RLS policy — data lands the same for every
-- user; only the render branches on plan tier.
-- ==========================================================================

ALTER TABLE public.barn_expenses
  ADD COLUMN IF NOT EXISTS receipt_file_path text,
  ADD COLUMN IF NOT EXISTS receipt_file_name text,
  ADD COLUMN IF NOT EXISTS receipt_mime_type text,
  ADD COLUMN IF NOT EXISTS receipt_extracted_data jsonb;

-- Index so "expenses that have a receipt" queries stay cheap. Partial
-- index — only rows where a receipt is attached end up in the index.
CREATE INDEX IF NOT EXISTS idx_barn_expenses_with_receipt
  ON public.barn_expenses (barn_id, performed_at DESC)
  WHERE receipt_file_path IS NOT NULL;
