"use server";

import { createServerComponentClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
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
  const barn_type: "standard" | "mare_motel" | "service" =
    barnTypeRaw === "mare_motel"
      ? "mare_motel"
      : barnTypeRaw === "service"
        ? "service"
        : "standard";
  const planTierSelected = String(formData.get("plan_tier_selected") ?? "free").trim();

  if (!name) {
    return { error: "Barn name is required." };
  }

  // Check one-free-barn rule: user can only have ONE free barn. Service
  // Barns are exempt — they have no capacity semantics (unlimited base
  // stalls) and don't compete with a standard barn for the one-free slot.
  const { count: freeBarns } = await supabase
    .from("barns")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id)
    .eq("plan_tier", "free")
    .neq("barn_type", "service");

  const isFirstBarn = (freeBarns ?? 0) === 0;

  const isService = barn_type === "service";
  // Free barns get 5 base stalls; paid barns get 10. Service Barns
  // default to 999 (effectively unlimited) and skip the paid path
  // entirely — the quick-records + linked-horses model means stall
  // capacity isn't a meaningful concept for mobile service providers.
  const isPaid = !isService && planTierSelected === "paid";
  const baseStalls = isService ? 999 : isPaid ? 10 : 5;

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
      base_stalls: baseStalls,
      plan_notes: isService
        ? "Service Barn — unlimited stalls, free"
        : isPaid
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

  // Cascade through every table that holds a barn_id FK. We do it
  // explicitly (rather than relying on ON DELETE CASCADE) because most
  // of these FKs predate the Business Pro / Service Barn / stall-block
  // additions and weren't defined with cascade. The paywall_interest
  // FK in particular has been throwing FK-violation errors on delete.
  //
  // Admin client skips RLS — ownership was verified above, and a few
  // of the Business Pro tables (barn_clients*) have owner-only RLS
  // that can flake in server-action contexts (same class of bug as
  // 4d18c68 for horses_insert).
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;

  // Business Pro: invoice line items first (FK → invoices), then
  // invoices themselves. Barn clients have per-client documents.
  const { data: invoiceRows } = await db
    .from("invoices")
    .select("id")
    .eq("barn_id", barnId);
  const invoiceIds = ((invoiceRows ?? []) as { id: string }[]).map((r) => r.id);
  if (invoiceIds.length > 0) {
    await db.from("invoice_line_items").delete().in("invoice_id", invoiceIds);
  }
  await db.from("invoices").delete().eq("barn_id", barnId);

  const { data: clientRows } = await db
    .from("barn_clients")
    .select("id")
    .eq("barn_id", barnId);
  const clientIds = ((clientRows ?? []) as { id: string }[]).map((r) => r.id);
  if (clientIds.length > 0) {
    await db.from("barn_client_documents").delete().in("client_id", clientIds);
  }
  await db.from("barn_clients").delete().eq("barn_id", barnId);

  await db.from("barn_expenses").delete().eq("barn_id", barnId);

  // Paywall interest + stall blocks — these had a FK with no cascade.
  await db.from("paywall_interest").delete().eq("barn_id", barnId);
  await db.from("barn_stall_blocks").delete().eq("barn_id", barnId);

  // Service Barn links pointed AT horses elsewhere or live on this
  // barn. Both sides — a service barn we're deleting, or a source barn
  // whose horses had been linked into someone else's service barn.
  await db.from("service_barn_links").delete().eq("service_barn_id", barnId);

  // Key lifecycle: requests, members, access keys.
  await db.from("key_requests").delete().eq("barn_id", barnId);
  await db.from("barn_members").delete().eq("barn_id", barnId);
  await db.from("access_keys").delete().eq("barn_id", barnId);

  // Media / profile / stays.
  await db.from("barn_photos").delete().eq("barn_id", barnId);
  await db.from("horse_stays").delete().eq("home_barn_id", barnId);
  await db.from("horse_stays").delete().eq("host_barn_id", barnId);

  const { error } = await db.from("barns").delete().eq("id", barnId);
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
