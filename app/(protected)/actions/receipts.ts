"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase-admin";
import { createServerComponentClient } from "@/lib/supabase-server";
import { HORSE_DOCUMENTS_BUCKET } from "@/lib/horse-documents";
import { isEditorPlusRole } from "@/lib/roles";
import type { ExtractedReceiptData } from "@/lib/document-extraction-prompt";

/**
 * Receipt attachment flow for barn_expenses rows.
 *
 * Scanned receipts live in the existing `horse-documents` Supabase
 * Storage bucket under a `{barn_id}/receipts/{uuid}-{name}` prefix.
 * The four `receipt_*` columns on `barn_expenses` carry the pointer
 * so every barn log is self-contained.
 *
 * Access rule: barn owner or editor member. No Business Pro gate —
 * that's a UI concern (non-BP users save receipts just fine; they
 * simply don't see the image in a UI until they upgrade).
 */

const RECEIPT_ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "image/webp",
]);
const RECEIPT_MAX_SIZE = 15 * 1024 * 1024;

function sanitizeFileName(name: string): string {
  const trimmed = name.trim().slice(0, 120);
  return trimmed
    .replace(/[\\/]/g, "-")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._\-]/g, "");
}

function newUniq(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function requireBarnWriter(barnId: string) {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" as const };

  const { data: barn } = await supabase
    .from("barns")
    .select("owner_id")
    .eq("id", barnId)
    .maybeSingle();
  if (!barn) return { error: "Barn not found" as const };
  if (barn.owner_id === user.id) return { supabase, userId: user.id, barnId };

  const { data: mem } = await supabase
    .from("barn_members")
    .select("role")
    .eq("barn_id", barnId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (mem && isEditorPlusRole(mem.role as string | null | undefined)) {
    return { supabase, userId: user.id, barnId };
  }

  return { error: "Must be the barn owner or editor to attach receipts" as const };
}

export interface ReceiptSignedUpload {
  signedUrl: string;
  token: string;
  file_path: string;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
}

/**
 * Mint a signed-upload URL at `{barn_id}/receipts/{uuid}-{name}`.
 * Client uses the URL + token with `storage.uploadToSignedUrl` to put
 * the image in place without needing a bucket policy that trusts the
 * authenticated role directly.
 */
export async function createReceiptSignedUploadAction(input: {
  barnId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}): Promise<{ ok?: true; upload?: ReceiptSignedUpload; error?: string }> {
  if (!RECEIPT_ALLOWED_MIME.has(input.mimeType)) {
    return { error: "Only JPEG, PNG, HEIC, or WebP files are accepted." };
  }
  if (input.fileSize > RECEIPT_MAX_SIZE) {
    return { error: "File is too large. Maximum size is 15 MB." };
  }

  const auth = await requireBarnWriter(input.barnId);
  if ("error" in auth) return { error: auth.error };

  const safe = sanitizeFileName(input.fileName) || "receipt";
  const path = `${auth.barnId}/receipts/${newUniq()}-${safe}`;

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any).storage
    .from(HORSE_DOCUMENTS_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data?.signedUrl || !data?.token) {
    return { error: error?.message ?? "Failed to get upload URL" };
  }

  return {
    ok: true,
    upload: {
      signedUrl: data.signedUrl as string,
      token: data.token as string,
      file_path: path,
      file_name: input.fileName,
      file_size_bytes: input.fileSize,
      mime_type: input.mimeType,
    },
  };
}

/**
 * Update an existing barn_expenses row with receipt pointer fields +
 * the raw extraction payload. Kept separate from createBarnLogAction
 * so the create-then-upload-then-attach ordering is explicit — the
 * log row exists even if the upload/attach fails, and the user never
 * loses the structured data they just reviewed.
 */
export async function attachReceiptToBarnLogAction(
  logId: string,
  input: {
    file_path: string;
    file_name: string;
    mime_type: string;
    extracted: ExtractedReceiptData;
  },
): Promise<{ ok?: true; error?: string }> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;

  const { data: existing } = await db
    .from("barn_expenses")
    .select("barn_id")
    .eq("id", logId)
    .maybeSingle();
  if (!existing) return { error: "Barn log not found" };

  const auth = await requireBarnWriter(existing.barn_id);
  if ("error" in auth) return { error: auth.error };

  const { error } = await db
    .from("barn_expenses")
    .update({
      receipt_file_path: input.file_path,
      receipt_file_name: input.file_name,
      receipt_mime_type: input.mime_type,
      receipt_extracted_data: input.extracted,
      updated_at: new Date().toISOString(),
    })
    .eq("id", logId);
  if (error) return { error: error.message };

  revalidatePath("/logs");
  revalidatePath("/business-pro/expenses");
  revalidatePath(`/business-pro/expenses/${logId}`);
  return { ok: true };
}

/**
 * Create one receipt's worth of barn_expenses rows in a single call —
 * used by the scan Review step when the user chose to split the
 * receipt across multiple categories. All rows share the same
 * `receipt_file_path` + `receipt_group_id`, so the Receipts bin can
 * coalesce them back into one "scan event."
 *
 * This is a single transactional-feeling call rather than a loop of
 * create + attach so we don't produce half-a-receipt on partial
 * failures: either all rows land with the receipt pointer, or none
 * do.
 */
export async function createSplitReceiptLogsAction(input: {
  barnId: string;
  receipt: {
    file_path: string;
    file_name: string;
    mime_type: string;
    extracted: ExtractedReceiptData;
  };
  splits: Array<{
    category: string;
    total_cost: number;
    description?: string | null;
    vendor_name?: string | null;
    notes?: string | null;
    performed_at: string;
    cost_type?: "expense" | "revenue" | "pass_through" | null;
  }>;
}): Promise<{ ok?: true; logIds?: string[]; error?: string }> {
  if (!input.splits || input.splits.length === 0) {
    return { error: "No line items to split" };
  }

  const auth = await requireBarnWriter(input.barnId);
  if ("error" in auth) return { error: auth.error };
  const { userId } = auth;

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;

  // One group id ties every row back to this one scan event.
  const groupId = newUniq();

  const rows = input.splits.map((s) => ({
    barn_id: input.barnId,
    created_by_user_id: userId,
    performed_at: s.performed_at,
    category: s.category.trim(),
    total_cost: Number.isFinite(s.total_cost) ? s.total_cost : 0,
    vendor_name: s.vendor_name?.trim() || null,
    description: s.description?.trim() || null,
    notes: s.notes?.trim() || null,
    cost_type: s.cost_type ?? "expense",
    receipt_file_path: input.receipt.file_path,
    receipt_file_name: input.receipt.file_name,
    receipt_mime_type: input.receipt.mime_type,
    receipt_extracted_data: input.receipt.extracted,
    receipt_group_id: groupId,
  }));

  const { data, error } = await db
    .from("barn_expenses")
    .insert(rows)
    .select("id");
  if (error || !data) {
    return { error: error?.message ?? "Failed to create split receipt" };
  }

  revalidatePath("/logs");
  revalidatePath("/business-pro/overview");
  revalidatePath("/business-pro/expenses");
  revalidatePath("/business-pro/receipts");
  revalidatePath(`/barn/${input.barnId}`);
  return { ok: true, logIds: (data as { id: string }[]).map((d) => d.id) };
}

/**
 * Clear the receipt pointer (the storage object stays — garbage
 * collection is deferred). Used by the "Remove receipt" button on
 * the BP expense detail.
 */
export async function clearReceiptAction(
  logId: string,
): Promise<{ ok?: true; error?: string }> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;

  const { data: existing } = await db
    .from("barn_expenses")
    .select("barn_id")
    .eq("id", logId)
    .maybeSingle();
  if (!existing) return { error: "Barn log not found" };

  const auth = await requireBarnWriter(existing.barn_id);
  if ("error" in auth) return { error: auth.error };

  const { error } = await db
    .from("barn_expenses")
    .update({
      receipt_file_path: null,
      receipt_file_name: null,
      receipt_mime_type: null,
      receipt_extracted_data: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", logId);
  if (error) return { error: error.message };

  revalidatePath("/logs");
  revalidatePath("/business-pro/expenses");
  revalidatePath(`/business-pro/expenses/${logId}`);
  return { ok: true };
}

/**
 * Mint a short-lived signed GET URL for a receipt image. BP users
 * call this from the detail page to render the thumbnail + open the
 * full size in a new tab. 1-hour TTL — user opens it, done.
 *
 * Gates on BP ownership at call time: we only want BP users fetching
 * receipt URLs. Non-BP users shouldn't even be calling this.
 */
export async function getReceiptSignedUrlAction(
  logId: string,
): Promise<{ signedUrl?: string; error?: string }> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // BP gate at the fetch layer — a stray direct call shouldn't leak
  // a signed URL. UI already hides the surface; this is defense in
  // depth.
  const { data: profile } = await supabase
    .from("profiles")
    .select("has_business_pro")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.has_business_pro) {
    return { error: "Business Pro required to view receipts." };
  }

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;

  const { data: row } = await db
    .from("barn_expenses")
    .select("barn_id, receipt_file_path")
    .eq("id", logId)
    .maybeSingle();
  if (!row || !row.receipt_file_path) {
    return { error: "No receipt attached to this entry." };
  }

  const auth = await requireBarnWriter(row.barn_id);
  if ("error" in auth) return { error: auth.error };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any).storage
    .from(HORSE_DOCUMENTS_BUCKET)
    .createSignedUrl(row.receipt_file_path as string, 60 * 60);
  if (error || !data?.signedUrl) {
    return { error: error?.message ?? "Could not generate URL" };
  }
  return { signedUrl: data.signedUrl as string };
}
