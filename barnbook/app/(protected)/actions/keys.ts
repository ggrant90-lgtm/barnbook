"use server";

import { getActiveBarnContext } from "@/lib/barn-session";
import { generateKeyCode } from "@/lib/key-code";
import { canManageBarnKeys } from "@/lib/key-access";
import { createServerComponentClient } from "@/lib/supabase-server";
import { createHash } from "crypto";
import { revalidatePath } from "next/cache";

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

function mapRequestRoleToMemberRole(desired: string): string {
  const r = desired.trim().toLowerCase();
  if (r === "editor") return "editor";
  if (r === "manager") return "manager";
  return "member";
}

export async function generateAccessKeyAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ error?: string; plainKey?: string }> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const ctx = await getActiveBarnContext(supabase, user.id);
  if (!ctx) return { error: "No barn context." };

  const barnId = ctx.barn.id;
  const ok = await canManageBarnKeys(supabase, user.id, barnId);
  if (!ok) return { error: "Only barn owners and managers can create keys." };

  const keyKind = String(formData.get("key_kind") ?? "barn");
  const key_type = keyKind === "stall" ? "stall" : "barn";
  let horse_id: string | null = null;
  if (key_type === "stall") {
    const hid = String(formData.get("horse_id") ?? "").trim();
    if (!hid) return { error: "Choose a horse for a stall key." };
    const { data: horse } = await supabase
      .from("horses")
      .select("id")
      .eq("id", hid)
      .eq("barn_id", barnId)
      .maybeSingle();
    if (!horse) return { error: "Invalid horse." };
    horse_id = hid;
  }

  const label = String(formData.get("label") ?? "").trim() || null;

  // New four-level permission system. Accept legacy `viewer`/`editor` from
  // any stale clients and map forward.
  const permRaw = String(formData.get("permission_level") ?? "log_all")
    .toLowerCase()
    .trim();
  const NEW_LEVELS = new Set([
    "view_only",
    "log_all",
    "full_contributor",
    "custom",
  ]);
  let permission_level: string;
  if (NEW_LEVELS.has(permRaw)) {
    permission_level = permRaw;
  } else if (permRaw === "editor") {
    permission_level = "log_all";
  } else {
    permission_level = "view_only";
  }

  // allowed_log_types[] — only meaningful for `custom`.
  const allowedRaw = formData.getAll("allowed_log_types[]") as string[];
  const VALID_LOG_TYPES = new Set([
    "exercise",
    "shoeing",
    "worming",
    "vet_visit",
    "feed",
    "medication",
    "note",
    "breed_data",
  ]);
  const allowed_log_types =
    permission_level === "custom"
      ? allowedRaw
          .map((s) => s.trim())
          .filter((s) => VALID_LOG_TYPES.has(s))
      : null;
  if (permission_level === "custom" && (allowed_log_types ?? []).length === 0) {
    return { error: "Pick at least one log type for custom permissions." };
  }

  const maxUsesRaw = String(formData.get("max_uses") ?? "").trim();
  const max_uses =
    maxUsesRaw === "" ? null : Math.max(1, Math.min(1_000_000, parseInt(maxUsesRaw, 10) || 0));

  const expRaw = String(formData.get("expires_at") ?? "").trim();
  const expires_at = expRaw === "" ? null : new Date(expRaw).toISOString();

  const prefix = key_type === "barn" ? "BK" : "SK";
  let plainKey = generateKeyCode(prefix);
  let inserted = false;
  for (let attempt = 0; attempt < 8 && !inserted; attempt++) {
    plainKey = generateKeyCode(prefix);
    const token_hash = sha256Hex(plainKey);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("access_keys").insert({
      barn_id: barnId,
      key_type,
      horse_id,
      label,
      key_code: plainKey,
      token_hash,
      permission_level,
      allowed_log_types,
      max_uses: max_uses && max_uses > 0 ? max_uses : null,
      times_used: 0,
      is_active: true,
      expires_at,
    });
    if (!error) {
      inserted = true;
      break;
    }
    if (!String(error.message).includes("duplicate") && !String(error.message).includes("unique")) {
      return { error: error.message };
    }
  }

  if (!inserted) return { error: "Could not generate a unique key. Try again." };

  revalidatePath("/keys");
  revalidatePath("/dashboard");
  return { plainKey };
}

export async function setAccessKeyActiveAction(
  keyId: string,
  is_active: boolean,
): Promise<{ error?: string }> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required." };

  const { data: row } = await supabase
    .from("access_keys")
    .select("barn_id")
    .eq("id", keyId)
    .maybeSingle();

  if (!row) return { error: "Key not found." };
  const ok = await canManageBarnKeys(supabase, user.id, row.barn_id);
  if (!ok) return { error: "Permission denied." };

  const { error } = await supabase.from("access_keys").update({ is_active }).eq("id", keyId);
  if (error) return { error: error.message };
  revalidatePath("/keys");
  return {};
}

export async function deleteAccessKeyAction(keyId: string): Promise<{ error?: string }> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required." };

  const { data: row } = await supabase
    .from("access_keys")
    .select("barn_id")
    .eq("id", keyId)
    .maybeSingle();

  if (!row) return { error: "Key not found." };
  const ok = await canManageBarnKeys(supabase, user.id, row.barn_id);
  if (!ok) return { error: "Permission denied." };

  const { error } = await supabase.from("access_keys").delete().eq("id", keyId);
  if (error) return { error: error.message };
  revalidatePath("/keys");
  return {};
}

export async function approveKeyRequestAction(requestId: string): Promise<{ error?: string }> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required." };

  const { data: req } = await supabase
    .from("key_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();

  if (!req || req.status !== "pending") return { error: "Request not found." };

  const ok = await canManageBarnKeys(supabase, user.id, req.barn_id);
  if (!ok) return { error: "Permission denied." };

  const role = mapRequestRoleToMemberRole(req.desired_role);

  const { data: existing } = await supabase
    .from("barn_members")
    .select("role")
    .eq("barn_id", req.barn_id)
    .eq("user_id", req.requester_id)
    .maybeSingle();

  if (!existing) {
    const { error: insErr } = await supabase.from("barn_members").insert({
      barn_id: req.barn_id,
      user_id: req.requester_id,
      role,
    });
    if (insErr) return { error: insErr.message };
  }

  const { error: upErr } = await supabase
    .from("key_requests")
    .update({ status: "approved" })
    .eq("id", requestId);

  if (upErr) return { error: upErr.message };

  revalidatePath("/keys");
  revalidatePath("/keys/requests");
  revalidatePath("/dashboard");
  return {};
}

export async function denyKeyRequestAction(requestId: string): Promise<{ error?: string }> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required." };

  const { data: req } = await supabase
    .from("key_requests")
    .select("barn_id, status")
    .eq("id", requestId)
    .maybeSingle();

  if (!req || req.status !== "pending") return { error: "Request not found." };

  const ok = await canManageBarnKeys(supabase, user.id, req.barn_id);
  if (!ok) return { error: "Permission denied." };

  const { error } = await supabase.from("key_requests").update({ status: "denied" }).eq("id", requestId);
  if (error) return { error: error.message };
  revalidatePath("/keys");
  revalidatePath("/keys/requests");
  return {};
}
