-- ==========================================================================
-- Document Scanner — horse_documents + api_call_log + has_document_scanner
-- ==========================================================================
-- Adds:
--   1. horse_documents — per-horse document vault with extracted data
--   2. api_call_log — rate limit counter + per-call cost tracking
--   3. profiles.has_document_scanner — per-user access flag (default false)
--
-- Storage bucket `horse-documents` is a manual dashboard step — see the
-- comment block at the bottom of this file for the policies to paste into
-- the SQL editor after creating the bucket.
-- ==========================================================================


-- ── 1. horse_documents table ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.horse_documents (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  horse_id                 uuid NOT NULL REFERENCES public.horses(id) ON DELETE CASCADE,
  barn_id                  uuid NOT NULL REFERENCES public.barns(id) ON DELETE CASCADE,

  document_type            text NOT NULL
                             CHECK (document_type IN ('coggins','registration','health_certificate','vet_record','other')),
  title                    text,

  file_path                text NOT NULL,
  file_name                text NOT NULL,
  file_size_bytes          bigint NOT NULL,
  mime_type                text NOT NULL,

  extracted_data           jsonb,
  scan_confidence          text CHECK (scan_confidence IN ('high','medium','low')),
  document_date            date,
  expiration_date          date,

  linked_health_record_id  uuid REFERENCES public.health_records(id) ON DELETE SET NULL,

  notes                    text,
  uploaded_by_user_id      uuid REFERENCES auth.users(id),
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_horse_documents_horse
  ON public.horse_documents(horse_id);
CREATE INDEX IF NOT EXISTS idx_horse_documents_barn
  ON public.horse_documents(barn_id);
CREATE INDEX IF NOT EXISTS idx_horse_documents_type
  ON public.horse_documents(barn_id, document_type);
CREATE INDEX IF NOT EXISTS idx_horse_documents_expiration
  ON public.horse_documents(expiration_date) WHERE expiration_date IS NOT NULL;

ALTER TABLE public.horse_documents ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'horse_documents_select') THEN
    CREATE POLICY horse_documents_select ON public.horse_documents
      FOR SELECT TO authenticated
      USING (is_barn_member(barn_id) OR is_barn_owner(barn_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'horse_documents_insert') THEN
    CREATE POLICY horse_documents_insert ON public.horse_documents
      FOR INSERT TO authenticated
      WITH CHECK (is_barn_member(barn_id) OR is_barn_owner(barn_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'horse_documents_update') THEN
    CREATE POLICY horse_documents_update ON public.horse_documents
      FOR UPDATE TO authenticated
      USING (is_barn_member(barn_id) OR is_barn_owner(barn_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'horse_documents_delete') THEN
    CREATE POLICY horse_documents_delete ON public.horse_documents
      FOR DELETE TO authenticated
      USING (is_barn_owner(barn_id));
  END IF;
END $$;


-- ── 2. api_call_log table ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.api_call_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint    text NOT NULL,              -- e.g. 'documents/extract'
  called_at   timestamptz NOT NULL DEFAULT now(),
  success     boolean NOT NULL,
  confidence  text,
  cost_cents  integer,                    -- rounded cost in cents
  error       text
);

CREATE INDEX IF NOT EXISTS idx_api_call_log_user_recent
  ON public.api_call_log(user_id, called_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_call_log_endpoint_month
  ON public.api_call_log(endpoint, called_at DESC);

ALTER TABLE public.api_call_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'api_call_log_self_select') THEN
    CREATE POLICY api_call_log_self_select ON public.api_call_log
      FOR SELECT TO authenticated
      USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'api_call_log_self_insert') THEN
    CREATE POLICY api_call_log_self_insert ON public.api_call_log
      FOR INSERT TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;


-- ── 3. profiles.has_document_scanner flag ─────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS has_document_scanner boolean NOT NULL DEFAULT false;


-- ==========================================================================
-- MANUAL STEP: Supabase Storage bucket + policies
-- ==========================================================================
-- 1. Supabase Dashboard → Storage → New bucket
--      Name: horse-documents
--      Public: NO (private)
--      Allowed MIME types:
--        image/jpeg, image/png, image/heic, image/heif, application/pdf
--      File size limit: 15 MB
--
-- 2. In SQL editor, run the four policies below (Storage policies live on
--    storage.objects which is owned by supabase_storage_admin — can't live
--    in a regular migration). Path convention: {barn_id}/{horse_id}/{uuid}-{name}
--
-- -- SELECT: any barn member or owner can download
-- CREATE POLICY "horse_docs_select" ON storage.objects
--   FOR SELECT TO authenticated
--   USING (
--     bucket_id = 'horse-documents'
--     AND (
--       is_barn_owner((storage.foldername(name))[1]::uuid)
--       OR is_barn_member((storage.foldername(name))[1]::uuid)
--     )
--   );
--
-- -- INSERT: barn members + owners can upload
-- CREATE POLICY "horse_docs_insert" ON storage.objects
--   FOR INSERT TO authenticated
--   WITH CHECK (
--     bucket_id = 'horse-documents'
--     AND (
--       is_barn_owner((storage.foldername(name))[1]::uuid)
--       OR is_barn_member((storage.foldername(name))[1]::uuid)
--     )
--   );
--
-- -- UPDATE: same as insert (rarely used, kept for completeness)
-- CREATE POLICY "horse_docs_update" ON storage.objects
--   FOR UPDATE TO authenticated
--   USING (
--     bucket_id = 'horse-documents'
--     AND (
--       is_barn_owner((storage.foldername(name))[1]::uuid)
--       OR is_barn_member((storage.foldername(name))[1]::uuid)
--     )
--   );
--
-- -- DELETE: barn owner only
-- CREATE POLICY "horse_docs_delete" ON storage.objects
--   FOR DELETE TO authenticated
--   USING (
--     bucket_id = 'horse-documents'
--     AND is_barn_owner((storage.foldername(name))[1]::uuid)
--   );
-- ==========================================================================
