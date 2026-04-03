"use server";

import { createServerComponentClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

export async function redeemKeyAction(rawCode: string): Promise<{
  ok: boolean;
  error?: string;
  redirectTo?: string;
}> {
  const code = rawCode.trim();
  if (!code) return { ok: false, error: "empty" };

  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_signed_in" };

  const { data, error } = await supabase.rpc("redeem_access_key", {
    p_raw_code: code,
    p_user_id: user.id,
  });

  if (error) return { ok: false, error: error.message };

  const j = data as {
    ok?: boolean;
    error?: string;
    key_type?: string;
    barn_id?: string;
    horse_id?: string | null;
  };

  if (!j?.ok) return { ok: false, error: j?.error ?? "unknown" };

  revalidatePath("/dashboard");
  revalidatePath("/horses");

  if (j.key_type === "stall" && j.horse_id) {
    return { ok: true, redirectTo: `/horses/${j.horse_id}` };
  }
  return { ok: true, redirectTo: "/dashboard" };
}

export async function submitKeyRequestAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in to request access." };

  const barnId = String(formData.get("barn_id") ?? "").trim();
  if (!barnId) return { error: "Missing barn." };

  const message = String(formData.get("message") ?? "").trim() || null;
  const desiredRaw = String(formData.get("desired_role") ?? "viewer").toLowerCase();
  const desired_role =
    desiredRaw === "editor" || desiredRaw === "manager" ? desiredRaw : "viewer";

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const { error } = await supabase.from("key_requests").insert({
    barn_id: barnId,
    requester_id: user.id,
    full_name: profile?.full_name?.trim() || null,
    email: user.email ?? null,
    desired_role,
    message,
    status: "pending",
  });

  if (error) return { error: error.message };
  revalidatePath("/keys");
  revalidatePath("/keys/requests");
  return { ok: true };
}
