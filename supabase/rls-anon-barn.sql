/*
  Equi-Track: RLS policies for the browser client (anon key).
  Paste this ENTIRE file into Supabase SQL Editor and Run.

  The UUID in policies below MUST match lib/constants.ts -> CURRENT_BARN_ID
  and your row in public.barns. If different, replace all occurrences.
*/

-- --- 1) Barn (sidebar title) -------------------------------------------------

DROP POLICY IF EXISTS "equi_anon_select_barn" ON public.barns;
CREATE POLICY "equi_anon_select_barn"
  ON public.barns
  FOR SELECT
  TO anon
  USING (id = '0ea8f75c-377c-4077-8202-233a23a5ef9b');

-- --- 2) Horses ---------------------------------------------------------------

DROP POLICY IF EXISTS "equi_anon_select_horses" ON public.horses;
CREATE POLICY "equi_anon_select_horses"
  ON public.horses
  FOR SELECT
  TO anon
  USING (barn_id = '0ea8f75c-377c-4077-8202-233a23a5ef9b');

DROP POLICY IF EXISTS "equi_anon_insert_horses" ON public.horses;
CREATE POLICY "equi_anon_insert_horses"
  ON public.horses
  FOR INSERT
  TO anon
  WITH CHECK (barn_id = '0ea8f75c-377c-4077-8202-233a23a5ef9b');

DROP POLICY IF EXISTS "equi_anon_update_horses" ON public.horses;
CREATE POLICY "equi_anon_update_horses"
  ON public.horses
  FOR UPDATE
  TO anon
  USING (barn_id = '0ea8f75c-377c-4077-8202-233a23a5ef9b')
  WITH CHECK (barn_id = '0ea8f75c-377c-4077-8202-233a23a5ef9b');

-- --- 3) Activity log ---------------------------------------------------------

DROP POLICY IF EXISTS "equi_anon_select_activity_log" ON public.activity_log;
CREATE POLICY "equi_anon_select_activity_log"
  ON public.activity_log
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM public.horses h
      WHERE h.id = activity_log.horse_id
        AND h.barn_id = '0ea8f75c-377c-4077-8202-233a23a5ef9b'
    )
  );

DROP POLICY IF EXISTS "equi_anon_insert_activity_log" ON public.activity_log;
CREATE POLICY "equi_anon_insert_activity_log"
  ON public.activity_log
  FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.horses h
      WHERE h.id = activity_log.horse_id
        AND h.barn_id = '0ea8f75c-377c-4077-8202-233a23a5ef9b'
    )
  );

-- --- 4) Health records -------------------------------------------------------

DROP POLICY IF EXISTS "equi_anon_select_health_records" ON public.health_records;
CREATE POLICY "equi_anon_select_health_records"
  ON public.health_records
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM public.horses h
      WHERE h.id = health_records.horse_id
        AND h.barn_id = '0ea8f75c-377c-4077-8202-233a23a5ef9b'
    )
  );

DROP POLICY IF EXISTS "equi_anon_insert_health_records" ON public.health_records;
CREATE POLICY "equi_anon_insert_health_records"
  ON public.health_records
  FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.horses h
      WHERE h.id = health_records.horse_id
        AND h.barn_id = '0ea8f75c-377c-4077-8202-233a23a5ef9b'
    )
  );

-- --- 5) Storage bucket horse-photos ------------------------------------------

DROP POLICY IF EXISTS "equi_anon_select_horse_photos" ON storage.objects;
CREATE POLICY "equi_anon_select_horse_photos"
  ON storage.objects
  FOR SELECT
  TO anon
  USING (bucket_id = 'horse-photos');

DROP POLICY IF EXISTS "equi_anon_insert_horse_photos" ON storage.objects;
CREATE POLICY "equi_anon_insert_horse_photos"
  ON storage.objects
  FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'horse-photos');

DROP POLICY IF EXISTS "equi_anon_update_horse_photos" ON storage.objects;
CREATE POLICY "equi_anon_update_horse_photos"
  ON storage.objects
  FOR UPDATE
  TO anon
  USING (bucket_id = 'horse-photos')
  WITH CHECK (bucket_id = 'horse-photos');

DROP POLICY IF EXISTS "equi_anon_delete_horse_photos" ON storage.objects;
CREATE POLICY "equi_anon_delete_horse_photos"
  ON storage.objects
  FOR DELETE
  TO anon
  USING (bucket_id = 'horse-photos');
