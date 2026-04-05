"use server";

import { createServerComponentClient } from "@/lib/supabase-server";
import { getBarnRoleForUser } from "@/lib/horse-access";
import { isOwnerOrManagerRole } from "@/lib/roles";
import { revalidatePath } from "next/cache";

export async function moveHorseAction(
  horseId: string,
  targetBarnId: string,
): Promise<{ error?: string }> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // Get the horse's current barn
  const { data: horse } = await supabase
    .from("horses")
    .select("barn_id, name")
    .eq("id", horseId)
    .single();
  if (!horse) return { error: "Horse not found." };

  // Check user is owner/manager of the current barn
  const role = await getBarnRoleForUser(supabase, user.id, horse.barn_id);
  if (!isOwnerOrManagerRole(role)) {
    return { error: "Only barn owners and managers can move horses." };
  }

  // Check user has access to the target barn
  const targetRole = await getBarnRoleForUser(supabase, user.id, targetBarnId);
  if (!targetRole) {
    return { error: "You don't have access to the target barn." };
  }

  if (horse.barn_id === targetBarnId) {
    return { error: "Horse is already in that barn." };
  }

  // Move the horse
  const { error } = await supabase
    .from("horses")
    .update({ barn_id: targetBarnId, updated_at: new Date().toISOString() })
    .eq("id", horseId);

  if (error) return { error: error.message };

  revalidatePath("/horses");
  revalidatePath(`/horses/${horseId}`);
  return {};
}
