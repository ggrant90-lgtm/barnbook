-- ==========================================================================
-- Key deletion cascades through user_horse_access and service_barn_links
-- ==========================================================================
-- Previously:
--   1. Stall Key owner deletes a key (access_keys row)
--   2. user_horse_access.source_key_id was `ON DELETE SET NULL`, so the
--      grant row survived the key deletion with source_key_id = null.
--      The key-holder kept their access silently.
--   3. service_barn_links for that user + horse were completely
--      untouched — the horse lingered in their Service Barn even
--      though the owner thought they'd revoked access.
--
-- This migration:
--   1. Changes the FK on user_horse_access.source_key_id to
--      ON DELETE CASCADE. Deleting the key now deletes the grant.
--   2. Adds a trigger on user_horse_access DELETE that prunes
--      service_barn_links for the affected user + horse — but only
--      when that user has no remaining path to the horse (not a barn
--      owner, not a barn member, no other stall-key grant).
--
-- Zero risk to existing data: only re-defines the FK constraint and
-- adds a new trigger. No rows are altered by the migration itself.
-- ==========================================================================


-- ── 1. Cascade access_keys → user_horse_access on delete ─────────────────
ALTER TABLE public.user_horse_access
  DROP CONSTRAINT IF EXISTS user_horse_access_source_key_id_fkey;

ALTER TABLE public.user_horse_access
  ADD CONSTRAINT user_horse_access_source_key_id_fkey
    FOREIGN KEY (source_key_id)
    REFERENCES public.access_keys(id)
    ON DELETE CASCADE;


-- ── 2. Prune service_barn_links when access is revoked ───────────────────
-- After a user_horse_access row is deleted, remove any service_barn_links
-- where that user had linked this horse into one of their Service Barns —
-- but only when they have no other remaining path to the horse.
CREATE OR REPLACE FUNCTION public.prune_service_barn_links_on_access_revoke()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.service_barn_links sbl
  USING public.barns sb, public.horses h
  WHERE sbl.service_barn_id = sb.id
    AND sb.owner_id = OLD.user_id
    AND sbl.horse_id = OLD.horse_id
    AND h.id = OLD.horse_id
    AND NOT (
      -- User still owns the horse's barn
      EXISTS (
        SELECT 1 FROM public.barns hb
        WHERE hb.id = h.barn_id
          AND hb.owner_id = OLD.user_id
      )
      -- User is still a member of the horse's barn
      OR EXISTS (
        SELECT 1 FROM public.barn_members bm
        WHERE bm.barn_id = h.barn_id
          AND bm.user_id = OLD.user_id
      )
      -- User has another active stall-key grant for this horse
      OR EXISTS (
        SELECT 1 FROM public.user_horse_access other
        WHERE other.user_id = OLD.user_id
          AND other.horse_id = OLD.horse_id
          AND other.id <> OLD.id
      )
    );
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS prune_service_barn_links_on_access_revoke
  ON public.user_horse_access;

CREATE TRIGGER prune_service_barn_links_on_access_revoke
  AFTER DELETE ON public.user_horse_access
  FOR EACH ROW
  EXECUTE FUNCTION public.prune_service_barn_links_on_access_revoke();
