"use server";

import { canManageBarnKeys } from "@/lib/key-access";
import { createServerComponentClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

/**
 * Update barn profile fields (about, contact, social, etc.)
 * Only owner/manager can do this.
 */
export async function updateBarnProfileAction(
  barnId: string,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required." };

  const ok = await canManageBarnKeys(supabase, user.id, barnId);
  if (!ok) return { error: "Permission denied." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Barn name is required." };

  const { error } = await supabase
    .from("barns")
    .update({
      name,
      address: String(formData.get("address") ?? "").trim() || null,
      city: String(formData.get("city") ?? "").trim() || null,
      state: String(formData.get("state") ?? "").trim() || null,
      zip: String(formData.get("zip") ?? "").trim() || null,
      about: String(formData.get("about") ?? "").trim() || null,
      website: String(formData.get("website") ?? "").trim() || null,
      instagram: String(formData.get("instagram") ?? "").trim() || null,
      facebook: String(formData.get("facebook") ?? "").trim() || null,
      public_email: String(formData.get("public_email") ?? "").trim() || null,
      public_phone: String(formData.get("public_phone") ?? "").trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", barnId);

  if (error) return { error: error.message };

  revalidatePath(`/barn/${barnId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Save barn logo URL after client-side upload. */
export async function updateBarnLogoAction(
  barnId: string,
  logoUrl: string,
): Promise<{ error?: string }> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required." };

  const ok = await canManageBarnKeys(supabase, user.id, barnId);
  if (!ok) return { error: "Permission denied." };

  const { error } = await supabase
    .from("barns")
    .update({ logo_url: logoUrl, updated_at: new Date().toISOString() })
    .eq("id", barnId);

  if (error) return { error: error.message };
  revalidatePath(`/barn/${barnId}`);
  return {};
}

/** Save barn banner URL after client-side upload. */
export async function updateBarnBannerAction(
  barnId: string,
  bannerUrl: string,
): Promise<{ error?: string }> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required." };

  const ok = await canManageBarnKeys(supabase, user.id, barnId);
  if (!ok) return { error: "Permission denied." };

  const { error } = await supabase
    .from("barns")
    .update({ banner_url: bannerUrl, updated_at: new Date().toISOString() })
    .eq("id", barnId);

  if (error) return { error: error.message };
  revalidatePath(`/barn/${barnId}`);
  return {};
}

/** Add a gallery photo record after client-side upload. */
export async function addBarnPhotoAction(
  barnId: string,
  photoUrl: string,
  caption?: string,
): Promise<{ error?: string }> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required." };

  const ok = await canManageBarnKeys(supabase, user.id, barnId);
  if (!ok) return { error: "Permission denied." };

  // Get max sort_order
  const { data: maxRow } = await supabase
    .from("barn_photos")
    .select("sort_order")
    .eq("barn_id", barnId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = (maxRow?.sort_order ?? 0) + 1;

  const { error } = await supabase.from("barn_photos").insert({
    barn_id: barnId,
    photo_url: photoUrl,
    caption: caption?.trim() || null,
    sort_order: nextOrder,
  });

  if (error) return { error: error.message };
  revalidatePath(`/barn/${barnId}`);
  return {};
}

/** Delete a gallery photo. */
export async function deleteBarnPhotoAction(
  photoId: string,
): Promise<{ error?: string }> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required." };

  const { data: photo } = await supabase
    .from("barn_photos")
    .select("barn_id")
    .eq("id", photoId)
    .maybeSingle();

  if (!photo) return { error: "Photo not found." };

  const ok = await canManageBarnKeys(supabase, user.id, photo.barn_id);
  if (!ok) return { error: "Permission denied." };

  const { error } = await supabase.from("barn_photos").delete().eq("id", photoId);
  if (error) return { error: error.message };

  revalidatePath(`/barn/${photo.barn_id}`);
  return {};
}
