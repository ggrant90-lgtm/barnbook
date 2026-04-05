"use server";

import { createServerComponentClient } from "@/lib/supabase-server";
import { getBarnRoleForUser } from "@/lib/horse-access";
import { isOwnerOrManagerRole } from "@/lib/roles";
import { revalidatePath } from "next/cache";

export async function createHorseStay(
  horseId: string,
  hostBarnId: string,
  notes?: string,
): Promise<{ error?: string }> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // Get the horse's home barn
  const { data: horse } = await supabase
    .from("horses")
    .select("barn_id")
    .eq("id", horseId)
    .single();
  if (!horse) return { error: "Horse not found." };

  // Check user is owner/manager of home barn
  const role = await getBarnRoleForUser(supabase, user.id, horse.barn_id);
  if (!isOwnerOrManagerRole(role)) {
    return { error: "Only barn owners and managers can send horses to a Mare Motel." };
  }

  // Verify host barn is a mare_motel
  const { data: hostBarn } = await supabase
    .from("barns")
    .select("id, barn_type")
    .eq("id", hostBarnId)
    .single();
  if (!hostBarn) return { error: "Host barn not found." };
  if (hostBarn.barn_type !== "mare_motel") {
    return { error: "The destination barn is not a Mare Motel." };
  }

  // Check no active stay already exists for this horse
  const { data: existing } = await supabase
    .from("horse_stays")
    .select("id")
    .eq("horse_id", horseId)
    .eq("status", "active")
    .maybeSingle();
  if (existing) {
    return { error: "This horse already has an active stay." };
  }

  const { error } = await supabase.from("horse_stays").insert({
    horse_id: horseId,
    home_barn_id: horse.barn_id,
    host_barn_id: hostBarnId,
    created_by_user_id: user.id,
    notes: notes?.trim() || null,
  });

  if (error) return { error: error.message };

  revalidatePath(`/horses/${horseId}`);
  revalidatePath("/horses");
  return {};
}

export async function endHorseStay(
  stayId: string,
): Promise<{ error?: string }> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: stay } = await supabase
    .from("horse_stays")
    .select("id, horse_id, home_barn_id, host_barn_id, status")
    .eq("id", stayId)
    .single();
  if (!stay) return { error: "Stay not found." };
  if (stay.status !== "active") return { error: "Stay is not active." };

  // Check user is owner/manager of either barn
  const homeRole = await getBarnRoleForUser(supabase, user.id, stay.home_barn_id);
  const hostRole = await getBarnRoleForUser(supabase, user.id, stay.host_barn_id);
  if (!isOwnerOrManagerRole(homeRole) && !isOwnerOrManagerRole(hostRole)) {
    return { error: "Only barn owners and managers can end a stay." };
  }

  const { error } = await supabase
    .from("horse_stays")
    .update({
      status: "completed",
      end_date: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", stayId);

  if (error) return { error: error.message };

  revalidatePath(`/horses/${stay.horse_id}`);
  revalidatePath("/horses");
  return {};
}
