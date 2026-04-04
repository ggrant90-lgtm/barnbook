"use server";

import { canManageBarnKeys } from "@/lib/key-access";
import { createServerComponentClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

/**
 * Change a barn member's role (e.g. downgrade trainer → viewer).
 * Only owner/manager can do this. Cannot change the barn owner's role.
 */
export async function updateMemberRoleAction(
  memberId: string,
  newRole: string,
): Promise<{ error?: string }> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required." };

  const { data: member } = await supabase
    .from("barn_members")
    .select("barn_id, user_id, role")
    .eq("id", memberId)
    .maybeSingle();

  if (!member) return { error: "Member not found." };

  const ok = await canManageBarnKeys(supabase, user.id, member.barn_id);
  if (!ok) return { error: "Permission denied." };

  // Don't allow changing the barn owner's role
  const { data: barn } = await supabase
    .from("barns")
    .select("owner_id")
    .eq("id", member.barn_id)
    .maybeSingle();

  if (barn?.owner_id === member.user_id) {
    return { error: "Cannot change the barn owner's role." };
  }

  const validRoles = ["viewer", "member", "editor", "trainer", "manager"];
  const role = newRole.trim().toLowerCase();
  if (!validRoles.includes(role)) return { error: "Invalid role." };

  const { error } = await supabase
    .from("barn_members")
    .update({ role })
    .eq("id", memberId);

  if (error) return { error: error.message };

  revalidatePath("/keys");
  revalidatePath("/dashboard");
  return {};
}

/**
 * Disable a barn member — they lose access but the record is preserved.
 * Sets status = 'disabled'. Can be re-enabled later.
 */
export async function disableMemberAction(
  memberId: string,
): Promise<{ error?: string }> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required." };

  const { data: member } = await supabase
    .from("barn_members")
    .select("barn_id, user_id")
    .eq("id", memberId)
    .maybeSingle();

  if (!member) return { error: "Member not found." };

  const ok = await canManageBarnKeys(supabase, user.id, member.barn_id);
  if (!ok) return { error: "Permission denied." };

  // Don't allow disabling the barn owner
  const { data: barn } = await supabase
    .from("barns")
    .select("owner_id")
    .eq("id", member.barn_id)
    .maybeSingle();

  if (barn?.owner_id === member.user_id) {
    return { error: "Cannot disable the barn owner." };
  }

  const { error } = await supabase
    .from("barn_members")
    .update({ status: "disabled" })
    .eq("id", memberId);

  if (error) return { error: error.message };

  revalidatePath("/keys");
  revalidatePath("/dashboard");
  return {};
}

/**
 * Re-enable a previously disabled barn member.
 * Sets status back to 'active'.
 */
export async function reenableMemberAction(
  memberId: string,
): Promise<{ error?: string }> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required." };

  const { data: member } = await supabase
    .from("barn_members")
    .select("barn_id")
    .eq("id", memberId)
    .maybeSingle();

  if (!member) return { error: "Member not found." };

  const ok = await canManageBarnKeys(supabase, user.id, member.barn_id);
  if (!ok) return { error: "Permission denied." };

  const { error } = await supabase
    .from("barn_members")
    .update({ status: "active" })
    .eq("id", memberId);

  if (error) return { error: error.message };

  revalidatePath("/keys");
  revalidatePath("/dashboard");
  return {};
}

/**
 * Permanently remove a barn member. Deletes the barn_members row.
 * The user would need a new key to regain access.
 */
export async function removeMemberAction(
  memberId: string,
): Promise<{ error?: string }> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required." };

  const { data: member } = await supabase
    .from("barn_members")
    .select("barn_id, user_id")
    .eq("id", memberId)
    .maybeSingle();

  if (!member) return { error: "Member not found." };

  const ok = await canManageBarnKeys(supabase, user.id, member.barn_id);
  if (!ok) return { error: "Permission denied." };

  // Don't allow removing the barn owner
  const { data: barn } = await supabase
    .from("barns")
    .select("owner_id")
    .eq("id", member.barn_id)
    .maybeSingle();

  if (barn?.owner_id === member.user_id) {
    return { error: "Cannot remove the barn owner." };
  }

  // Also remove any user_horse_access for this user in this barn's horses
  const { data: barnHorses } = await supabase
    .from("horses")
    .select("id")
    .eq("barn_id", member.barn_id);

  if (barnHorses && barnHorses.length > 0) {
    const horseIds = barnHorses.map((h) => h.id);
    await supabase
      .from("user_horse_access")
      .delete()
      .eq("user_id", member.user_id)
      .in("horse_id", horseIds);
  }

  const { error } = await supabase
    .from("barn_members")
    .delete()
    .eq("id", memberId);

  if (error) return { error: error.message };

  revalidatePath("/keys");
  revalidatePath("/dashboard");
  return {};
}
