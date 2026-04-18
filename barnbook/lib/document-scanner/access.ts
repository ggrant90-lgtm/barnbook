import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Plan tiers that grant automatic document-scanner access.
 * Free-tier barns require an explicit `has_document_scanner = true` flag.
 */
export const PAID_BARN_TIERS = ["paid", "comped"] as const;

/**
 * Check whether the user is allowed to use the document scanner.
 *
 * Access is granted if EITHER:
 *   - profiles.has_document_scanner is true (admin-granted), OR
 *   - the user is acting within a barn whose plan_tier is paid/comped AND
 *     they are the owner or an active member of that barn.
 *
 * @param barnId Optional — when absent, only the profile flag is checked
 *   (used to decide whether to show scanner UI on pages without barn context).
 */
export async function canUserUseDocumentScanner(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string,
  barnId: string | null,
): Promise<boolean> {
  // 1. Profile-level flag — takes precedence, no barn context needed.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("has_document_scanner")
    .eq("id", userId)
    .maybeSingle();
  if (profile?.has_document_scanner === true) return true;

  if (!barnId) return false;

  // 2. Barn plan tier — user must be a member/owner of a paid/comped barn.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: barn } = await (supabase as any)
    .from("barns")
    .select("plan_tier, owner_id")
    .eq("id", barnId)
    .maybeSingle();
  if (!barn) return false;
  if (!(PAID_BARN_TIERS as readonly string[]).includes(barn.plan_tier)) {
    return false;
  }

  // User must own or be a member of this barn (RLS on `barns` would block
  // the read otherwise, but double-check for defense in depth).
  if (barn.owner_id === userId) return true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: member } = await (supabase as any)
    .from("barn_members")
    .select("id")
    .eq("barn_id", barnId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!member;
}

/**
 * Lightweight variant — returns true if the user has scanner access for
 * ANY of their accessible barns. Used on pages without barn context (e.g.
 * `/identify`) to decide whether to show the Document tile at all.
 */
export async function userHasAnyScannerAccess(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string,
): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("has_document_scanner")
    .eq("id", userId)
    .maybeSingle();
  if (profile?.has_document_scanner === true) return true;

  // Any owned barn on a paid tier?
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: ownedBarns } = await (supabase as any)
    .from("barns")
    .select("id")
    .eq("owner_id", userId)
    .in("plan_tier", PAID_BARN_TIERS as readonly string[])
    .limit(1);
  if ((ownedBarns ?? []).length > 0) return true;

  // Any member barn on a paid tier?
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: memberships } = await (supabase as any)
    .from("barn_members")
    .select("barn_id, barns!inner(plan_tier)")
    .eq("user_id", userId)
    .in("barns.plan_tier", PAID_BARN_TIERS as readonly string[])
    .limit(1);
  return (memberships ?? []).length > 0;
}
