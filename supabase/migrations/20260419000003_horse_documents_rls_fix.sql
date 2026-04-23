-- ==========================================================================
-- Fix "new row violates row-level security policy" on the document scanner.
-- ==========================================================================
-- Same class of bug as 20260419000002 for horses_insert: RLS policies on
-- horse_documents depend on the SECURITY DEFINER helpers is_barn_owner /
-- is_barn_member, and in some Next.js server-action + Supabase SSR
-- contexts the helper calls fail for legitimate barn owners (either
-- because EXECUTE was revoked, or because auth.uid() inside the helper
-- resolves unexpectedly).
--
-- Defense in depth:
--   1. Re-GRANT EXECUTE on the helpers (idempotent safety net).
--   2. Inline the ownership / membership checks on every horse_documents
--      policy so the scanner path does not depend on any helper.
--
-- Storage.objects policies for the `horse-documents` bucket live outside
-- this migration (owner is supabase_storage_admin). The comment block at
-- the bottom has replacement SQL to paste into the Supabase SQL editor
-- if the upload step is the failing one.
--
-- Idempotent: GRANT is a no-op if already granted; DROP IF EXISTS + CREATE
-- for every policy.
-- ==========================================================================


-- ── 1. Re-grant EXECUTE on helper functions ────────────────────────────────
GRANT EXECUTE ON FUNCTION public.is_barn_owner(uuid)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_barn_member(uuid) TO authenticated;


-- ── 2. Inline policies on horse_documents ──────────────────────────────────
-- All subqueries explicitly qualify columns so there's no name-collision
-- between horse_documents.barn_id and barn_members.barn_id.

DROP POLICY IF EXISTS horse_documents_select ON public.horse_documents;
CREATE POLICY horse_documents_select ON public.horse_documents
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.barns b
      WHERE b.id = horse_documents.barn_id
        AND b.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.barn_members bm
      WHERE bm.barn_id = horse_documents.barn_id
        AND bm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS horse_documents_insert ON public.horse_documents;
CREATE POLICY horse_documents_insert ON public.horse_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.barns b
      WHERE b.id = horse_documents.barn_id
        AND b.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.barn_members bm
      WHERE bm.barn_id = horse_documents.barn_id
        AND bm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS horse_documents_update ON public.horse_documents;
CREATE POLICY horse_documents_update ON public.horse_documents
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.barns b
      WHERE b.id = horse_documents.barn_id
        AND b.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.barn_members bm
      WHERE bm.barn_id = horse_documents.barn_id
        AND bm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS horse_documents_delete ON public.horse_documents;
CREATE POLICY horse_documents_delete ON public.horse_documents
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.barns b
      WHERE b.id = horse_documents.barn_id
        AND b.owner_id = auth.uid()
    )
  );


-- ==========================================================================
-- MANUAL STEP: replacement storage.objects policies for the
--              `horse-documents` bucket. Paste into Supabase SQL editor
--              only if uploads are still failing with an RLS error after
--              this migration. These policies also inline the barn-owner /
--              member checks so they don't depend on the helpers.
-- ==========================================================================
--
-- DROP POLICY IF EXISTS "horse_docs_select" ON storage.objects;
-- CREATE POLICY "horse_docs_select" ON storage.objects
--   FOR SELECT TO authenticated
--   USING (
--     bucket_id = 'horse-documents'
--     AND (
--       EXISTS (
--         SELECT 1 FROM public.barns b
--         WHERE b.id = (storage.foldername(name))[1]::uuid
--           AND b.owner_id = auth.uid()
--       )
--       OR EXISTS (
--         SELECT 1 FROM public.barn_members bm
--         WHERE bm.barn_id = (storage.foldername(name))[1]::uuid
--           AND bm.user_id = auth.uid()
--       )
--     )
--   );
--
-- DROP POLICY IF EXISTS "horse_docs_insert" ON storage.objects;
-- CREATE POLICY "horse_docs_insert" ON storage.objects
--   FOR INSERT TO authenticated
--   WITH CHECK (
--     bucket_id = 'horse-documents'
--     AND (
--       EXISTS (
--         SELECT 1 FROM public.barns b
--         WHERE b.id = (storage.foldername(name))[1]::uuid
--           AND b.owner_id = auth.uid()
--       )
--       OR EXISTS (
--         SELECT 1 FROM public.barn_members bm
--         WHERE bm.barn_id = (storage.foldername(name))[1]::uuid
--           AND bm.user_id = auth.uid()
--       )
--     )
--   );
--
-- DROP POLICY IF EXISTS "horse_docs_update" ON storage.objects;
-- CREATE POLICY "horse_docs_update" ON storage.objects
--   FOR UPDATE TO authenticated
--   USING (
--     bucket_id = 'horse-documents'
--     AND (
--       EXISTS (
--         SELECT 1 FROM public.barns b
--         WHERE b.id = (storage.foldername(name))[1]::uuid
--           AND b.owner_id = auth.uid()
--       )
--       OR EXISTS (
--         SELECT 1 FROM public.barn_members bm
--         WHERE bm.barn_id = (storage.foldername(name))[1]::uuid
--           AND bm.user_id = auth.uid()
--       )
--     )
--   );
--
-- DROP POLICY IF EXISTS "horse_docs_delete" ON storage.objects;
-- CREATE POLICY "horse_docs_delete" ON storage.objects
--   FOR DELETE TO authenticated
--   USING (
--     bucket_id = 'horse-documents'
--     AND EXISTS (
--       SELECT 1 FROM public.barns b
--       WHERE b.id = (storage.foldername(name))[1]::uuid
--         AND b.owner_id = auth.uid()
--     )
--   );
-- ==========================================================================
