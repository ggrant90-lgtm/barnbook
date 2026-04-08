"use server";

import { createServerComponentClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createBarnAction(
  _prev: { error?: string } | null,
  formData: FormData,
): Promise<{ error?: string } | null> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in." };
  }


  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim() || null;
  const city = String(formData.get("city") ?? "").trim() || null;
  const state = String(formData.get("state") ?? "").trim() || null;
  const zip = String(formData.get("zip") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const barnTypeRaw = String(formData.get("barn_type") ?? "standard").trim();
  const barn_type = barnTypeRaw === "mare_motel" ? "mare_motel" : "standard";
  const planTierSelected = String(formData.get("plan_tier_selected") ?? "free").trim();

  if (!name) {
    return { error: "Barn name is required." };
  }

  // Check one-free-barn rule: user can only have ONE free barn
  const { count: freeBarns } = await supabase
    .from("barns")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id)
    .eq("plan_tier", "free");

  const isFirstBarn = (freeBarns ?? 0) === 0;

  // Free barns get 5 stalls, paid barns get 10
  const isPaid = planTierSelected === "paid";
  const stallCapacity = isPaid ? 10 : 5;

  const { data: barn, error: barnErr } = await supabase
    .from("barns")
    .insert({
      name,
      owner_id: user.id,
      address,
      city,
      state,
      zip,
      phone,
      barn_type,
      plan_tier: isPaid ? "paid" : "free",
      stall_capacity: stallCapacity,
      plan_notes: isPaid
        ? "10-stall paid barn — $25/mo"
        : isFirstBarn
          ? "First free barn"
          : "Additional free barn",
      plan_started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  // If they selected the paid tier, capture interest for Stripe launch
  if (isPaid && barn) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("paywall_interest").insert({
      user_id: user.id,
      barn_id: barn.id,
      plan_requested: "10_stall_barn_25mo",
      email: user.email ?? "",
    });
  }

  if (barnErr || !barn) {
    return { error: barnErr?.message ?? "Could not create barn." };
  }

  const { error: memErr } = await supabase.from("barn_members").insert({
    barn_id: barn.id,
    user_id: user.id,
    role: "owner",
  });

  if (memErr) {
    return { error: memErr.message };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function deleteBarnAction(
  barnId: string,
): Promise<{ error?: string }> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // Only the barn owner can delete
  const { data: barn } = await supabase
    .from("barns")
    .select("id, owner_id, name")
    .eq("id", barnId)
    .single();

  if (!barn) return { error: "Barn not found." };
  if (barn.owner_id !== user.id) return { error: "Only the barn owner can delete a barn." };

  // Check for horses still in this barn
  const { count } = await supabase
    .from("horses")
    .select("id", { count: "exact", head: true })
    .eq("barn_id", barnId);

  if (count && count > 0) {
    return { error: `Move or remove all ${count} horse(s) from this barn before deleting it.` };
  }

  // Delete barn_members, access_keys, barn_photos, then the barn
  await supabase.from("barn_members").delete().eq("barn_id", barnId);
  await supabase.from("access_keys").delete().eq("barn_id", barnId);
  await supabase.from("barn_photos").delete().eq("barn_id", barnId);
  await supabase.from("horse_stays").delete().eq("home_barn_id", barnId);
  await supabase.from("horse_stays").delete().eq("host_barn_id", barnId);

  const { error } = await supabase.from("barns").delete().eq("id", barnId);
  if (error) return { error: error.message };

  // Clear active barn cookie if it was this barn
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  if (cookieStore.get("active_barn_id")?.value === barnId) {
    cookieStore.delete("active_barn_id");
  }

  revalidatePath("/", "layout");
  return {};
}
