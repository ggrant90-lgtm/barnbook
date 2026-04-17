"use server";

import { createAdminClient } from "@/lib/supabase-admin";
import { isUserAdmin } from "@/lib/admin";
import { createServerComponentClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

/**
 * Toggle a feature flag (has_breeders_pro or has_business_pro) on a user's profile.
 * Admin only. Logs to admin_audit_log.
 */
export async function toggleUserFeatureAction(
  userId: string,
  feature: "has_breeders_pro" | "has_business_pro",
  value: boolean,
): Promise<{ ok?: true; error?: string }> {
  const admin = await isUserAdmin();
  if (!admin) return { error: "Not authorized" };

  const supabase = await createServerComponentClient();
  const {
    data: { user: actor },
  } = await supabase.auth.getUser();
  if (!actor) return { error: "Not authenticated" };

  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch {
    return { error: "Admin client not configured" };
  }

  const patch: Record<string, unknown> = { [feature]: value };

  // For Business Pro specifically, record the enable timestamp + actor
  if (feature === "has_business_pro") {
    patch.business_pro_enabled_at = value ? new Date().toISOString() : null;
    patch.business_pro_enabled_by = value ? actor.id : null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (adminClient as any)
    .from("profiles")
    .update(patch)
    .eq("id", userId);
  if (error) return { error: error.message };

  // Log to audit (best-effort — don't block on it)
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (adminClient as any).from("admin_audit_log").insert({
      admin_user_id: actor.id,
      action: `${value ? "enable" : "disable"}_${feature}`,
      target_type: "profile",
      target_id: userId,
      details: { feature, value },
    });
  } catch {
    // Audit log might not exist yet — fail silently
  }

  revalidatePath("/admin");
  return { ok: true };
}
