-- ==========================================================================
-- Business Pro — Clients (CRM) + Document Vault
-- ==========================================================================
-- Adds:
--   1. barn_clients — per-barn directory of billable contacts (owners,
--      boarders, lesson clients). Dedicated replacement for the three-way
--      billable_to_* pattern, but legacy columns stay populated as snapshots.
--   2. barn_client_documents — per-client document metadata. Actual files
--      live in a private Supabase Storage bucket `client-documents`.
--   3. Optional `client_id` FK on invoices, activity_log, health_records,
--      barn_expenses — additive, nullable, preserves legacy billable_to_*.
--   4. One-shot idempotent backfill from existing billable_to_user_id /
--      billable_to_name / horses.owner_name.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS,
-- ON CONFLICT DO NOTHING, WHERE client_id IS NULL on UPDATEs.
-- ==========================================================================


-- ── 1a. barn_clients table ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.barn_clients (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barn_id            uuid NOT NULL REFERENCES public.barns(id) ON DELETE CASCADE,

  display_name       text NOT NULL,
  user_id            uuid REFERENCES public.profiles(id),
  name_key           text NOT NULL,  -- lower(trim(display_name)) for dedupe

  email              text,
  phone              text,

  address_line1      text,
  address_line2      text,
  address_city       text,
  address_state      text,
  address_postal     text,
  address_country    text DEFAULT 'US',

  notes              text,
  archived           boolean NOT NULL DEFAULT false,

  created_by_user_id uuid REFERENCES auth.users(id),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_barn_clients_barn_name_key
  ON public.barn_clients(barn_id, name_key);
CREATE UNIQUE INDEX IF NOT EXISTS idx_barn_clients_barn_user
  ON public.barn_clients(barn_id, user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_barn_clients_barn_active
  ON public.barn_clients(barn_id) WHERE archived = false;

ALTER TABLE public.barn_clients ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'barn_clients_select') THEN
    CREATE POLICY barn_clients_select ON public.barn_clients
      FOR SELECT TO authenticated
      USING (is_barn_member(barn_id) OR is_barn_owner(barn_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'barn_clients_insert') THEN
    CREATE POLICY barn_clients_insert ON public.barn_clients
      FOR INSERT TO authenticated
      WITH CHECK (is_barn_owner(barn_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'barn_clients_update') THEN
    CREATE POLICY barn_clients_update ON public.barn_clients
      FOR UPDATE TO authenticated
      USING (is_barn_owner(barn_id) OR is_barn_member(barn_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'barn_clients_delete') THEN
    CREATE POLICY barn_clients_delete ON public.barn_clients
      FOR DELETE TO authenticated
      USING (is_barn_owner(barn_id));
  END IF;
END $$;


-- ── 1b. barn_client_documents table ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.barn_client_documents (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           uuid NOT NULL REFERENCES public.barn_clients(id) ON DELETE CASCADE,
  barn_id             uuid NOT NULL REFERENCES public.barns(id) ON DELETE CASCADE,

  doc_type            text NOT NULL
                        CHECK (doc_type IN ('boarding_agreement','training_contract','waiver','proposal','w9','other')),
  custom_label        text,
  title               text NOT NULL,

  file_path           text NOT NULL,
  file_name           text NOT NULL,
  file_size_bytes     bigint NOT NULL,
  mime_type           text NOT NULL,

  effective_date      date,
  expiry_date         date,

  uploaded_by_user_id uuid REFERENCES auth.users(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_docs_client ON public.barn_client_documents(client_id);
CREATE INDEX IF NOT EXISTS idx_client_docs_barn   ON public.barn_client_documents(barn_id);
CREATE INDEX IF NOT EXISTS idx_client_docs_expiry
  ON public.barn_client_documents(expiry_date) WHERE expiry_date IS NOT NULL;

ALTER TABLE public.barn_client_documents ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'barn_client_docs_select') THEN
    CREATE POLICY barn_client_docs_select ON public.barn_client_documents
      FOR SELECT TO authenticated
      USING (is_barn_member(barn_id) OR is_barn_owner(barn_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'barn_client_docs_insert') THEN
    CREATE POLICY barn_client_docs_insert ON public.barn_client_documents
      FOR INSERT TO authenticated
      WITH CHECK (is_barn_owner(barn_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'barn_client_docs_update') THEN
    CREATE POLICY barn_client_docs_update ON public.barn_client_documents
      FOR UPDATE TO authenticated
      USING (is_barn_owner(barn_id) OR is_barn_member(barn_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'barn_client_docs_delete') THEN
    CREATE POLICY barn_client_docs_delete ON public.barn_client_documents
      FOR DELETE TO authenticated
      USING (is_barn_owner(barn_id));
  END IF;
END $$;


-- ── 1c. client_id columns on linked tables ────────────────────────────────
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.barn_clients(id) ON DELETE SET NULL;
ALTER TABLE public.activity_log
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.barn_clients(id) ON DELETE SET NULL;
ALTER TABLE public.health_records
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.barn_clients(id) ON DELETE SET NULL;
ALTER TABLE public.barn_expenses
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.barn_clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_client
  ON public.invoices(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activity_log_client
  ON public.activity_log(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_health_records_client
  ON public.health_records(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_barn_expenses_client
  ON public.barn_expenses(client_id) WHERE client_id IS NOT NULL;


-- ── 1d. Backfill (idempotent) ─────────────────────────────────────────────
DO $$
DECLARE
  b record;
BEGIN
  FOR b IN SELECT id AS barn_id FROM public.barns LOOP

    -- Seed from distinct billable_to_user_id across three source tables.
    INSERT INTO public.barn_clients (barn_id, display_name, user_id, name_key)
    SELECT b.barn_id,
           COALESCE(NULLIF(trim(p.full_name), ''), 'Member'),
           p.id,
           lower(trim(COALESCE(NULLIF(p.full_name, ''), p.id::text)))
    FROM public.profiles p
    WHERE p.id IN (
      SELECT DISTINCT al.billable_to_user_id
        FROM public.activity_log al
        JOIN public.horses h ON h.id = al.horse_id
       WHERE h.barn_id = b.barn_id AND al.billable_to_user_id IS NOT NULL
      UNION
      SELECT DISTINCT hr.billable_to_user_id
        FROM public.health_records hr
        JOIN public.horses h ON h.id = hr.horse_id
       WHERE h.barn_id = b.barn_id AND hr.billable_to_user_id IS NOT NULL
      UNION
      SELECT DISTINCT inv.billable_to_user_id
        FROM public.invoices inv
       WHERE inv.barn_id = b.barn_id AND inv.billable_to_user_id IS NOT NULL
    )
    ON CONFLICT (barn_id, user_id) WHERE user_id IS NOT NULL DO NOTHING;

    -- Seed from distinct billable_to_name (freeform, no user).
    INSERT INTO public.barn_clients (barn_id, display_name, name_key)
    SELECT b.barn_id, trim(src.name), lower(trim(src.name))
    FROM (
      SELECT DISTINCT al.billable_to_name AS name
        FROM public.activity_log al
        JOIN public.horses h ON h.id = al.horse_id
       WHERE h.barn_id = b.barn_id
         AND al.billable_to_name IS NOT NULL
         AND length(trim(al.billable_to_name)) > 0
         AND al.billable_to_user_id IS NULL
      UNION
      SELECT DISTINCT hr.billable_to_name
        FROM public.health_records hr
        JOIN public.horses h ON h.id = hr.horse_id
       WHERE h.barn_id = b.barn_id
         AND hr.billable_to_name IS NOT NULL
         AND length(trim(hr.billable_to_name)) > 0
         AND hr.billable_to_user_id IS NULL
      UNION
      SELECT DISTINCT inv.billable_to_name
        FROM public.invoices inv
       WHERE inv.barn_id = b.barn_id
         AND inv.billable_to_name IS NOT NULL
         AND length(trim(inv.billable_to_name)) > 0
         AND inv.billable_to_user_id IS NULL
    ) src
    ON CONFLICT (barn_id, name_key) DO NOTHING;

    -- Seed from distinct horses.owner_name.
    INSERT INTO public.barn_clients (barn_id, display_name, name_key)
    SELECT b.barn_id, trim(h.owner_name), lower(trim(h.owner_name))
    FROM public.horses h
    WHERE h.barn_id = b.barn_id
      AND h.owner_name IS NOT NULL
      AND length(trim(h.owner_name)) > 0
    GROUP BY trim(h.owner_name), lower(trim(h.owner_name))
    ON CONFLICT (barn_id, name_key) DO NOTHING;

    -- Populate client_id on existing invoices via user_id OR name_key match.
    UPDATE public.invoices inv
       SET client_id = bc.id
      FROM public.barn_clients bc
     WHERE inv.barn_id = b.barn_id
       AND inv.client_id IS NULL
       AND bc.barn_id = b.barn_id
       AND (
         (inv.billable_to_user_id IS NOT NULL AND inv.billable_to_user_id = bc.user_id)
         OR (inv.billable_to_user_id IS NULL
             AND inv.billable_to_name IS NOT NULL
             AND lower(trim(inv.billable_to_name)) = bc.name_key)
       );

    -- Same for activity_log (need a barn_id via horse join).
    UPDATE public.activity_log al
       SET client_id = bc.id
      FROM public.barn_clients bc, public.horses h
     WHERE h.id = al.horse_id
       AND h.barn_id = b.barn_id
       AND al.client_id IS NULL
       AND bc.barn_id = b.barn_id
       AND (
         (al.billable_to_user_id IS NOT NULL AND al.billable_to_user_id = bc.user_id)
         OR (al.billable_to_user_id IS NULL
             AND al.billable_to_name IS NOT NULL
             AND lower(trim(al.billable_to_name)) = bc.name_key)
       );

    -- health_records
    UPDATE public.health_records hr
       SET client_id = bc.id
      FROM public.barn_clients bc, public.horses h
     WHERE h.id = hr.horse_id
       AND h.barn_id = b.barn_id
       AND hr.client_id IS NULL
       AND bc.barn_id = b.barn_id
       AND (
         (hr.billable_to_user_id IS NOT NULL AND hr.billable_to_user_id = bc.user_id)
         OR (hr.billable_to_user_id IS NULL
             AND hr.billable_to_name IS NOT NULL
             AND lower(trim(hr.billable_to_name)) = bc.name_key)
       );

    -- barn_expenses (scoped by barn_id directly, no horse join needed).
    UPDATE public.barn_expenses be
       SET client_id = bc.id
      FROM public.barn_clients bc
     WHERE be.barn_id = b.barn_id
       AND be.client_id IS NULL
       AND bc.barn_id = b.barn_id
       AND (
         (be.billable_to_user_id IS NOT NULL AND be.billable_to_user_id = bc.user_id)
         OR (be.billable_to_user_id IS NULL
             AND be.billable_to_name IS NOT NULL
             AND lower(trim(be.billable_to_name)) = bc.name_key)
       );

  END LOOP;
END $$;


-- ==========================================================================
-- MANUAL STEP: Supabase Storage bucket + policies
-- ==========================================================================
-- Run the SQL below in the Supabase SQL editor AFTER creating the bucket
-- via the dashboard:
--   1. Supabase Dashboard → Storage → New bucket
--      Name: client-documents
--      Public: NO  (private)
--      Allowed MIME types: application/pdf,
--                          application/msword,
--                          application/vnd.openxmlformats-officedocument.wordprocessingml.document
--      File size limit: 20 MB
--
--   2. Then run these policies in SQL editor (storage.objects is owned by
--      supabase_storage_admin so they can't live in a regular migration
--      without custom grants):
--
--      -- SELECT: members + owners of the barn whose id is the first path segment
--      CREATE POLICY "client_docs_select" ON storage.objects
--        FOR SELECT TO authenticated
--        USING (
--          bucket_id = 'client-documents'
--          AND (
--            is_barn_owner((storage.foldername(name))[1]::uuid)
--            OR is_barn_member((storage.foldername(name))[1]::uuid)
--          )
--        );
--
--      -- INSERT: barn owner only
--      CREATE POLICY "client_docs_insert" ON storage.objects
--        FOR INSERT TO authenticated
--        WITH CHECK (
--          bucket_id = 'client-documents'
--          AND is_barn_owner((storage.foldername(name))[1]::uuid)
--        );
--
--      -- UPDATE: barn owner only
--      CREATE POLICY "client_docs_update" ON storage.objects
--        FOR UPDATE TO authenticated
--        USING (
--          bucket_id = 'client-documents'
--          AND is_barn_owner((storage.foldername(name))[1]::uuid)
--        );
--
--      -- DELETE: barn owner only
--      CREATE POLICY "client_docs_delete" ON storage.objects
--        FOR DELETE TO authenticated
--        USING (
--          bucket_id = 'client-documents'
--          AND is_barn_owner((storage.foldername(name))[1]::uuid)
--        );
--
-- Path convention used by the app: {barn_id}/{client_id}/{doc_id}-{filename}
-- which makes (storage.foldername(name))[1] = barn_id.
-- ==========================================================================
