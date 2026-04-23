"use server";

import { createServerComponentClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import { CLIENT_DOCUMENTS_BUCKET } from "@/lib/client-documents";

/** Guard: require Business Pro + barn owner. Mirrors invoices.ts. */
async function requireBusinessProOwner(barnId: string) {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" as const };

  const { data: profile } = await supabase
    .from("profiles")
    .select("has_business_pro")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.has_business_pro) {
    return { error: "Business Pro required" as const };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: barn } = await (supabase as any)
    .from("barns")
    .select("owner_id")
    .eq("id", barnId)
    .maybeSingle();
  if (!barn || barn.owner_id !== user.id) {
    return { error: "Must be the barn owner to manage clients" as const };
  }

  return { supabase, userId: user.id };
}

function normalizeNameKey(s: string): string {
  return s.trim().toLowerCase();
}

function revalidateClients(clientId?: string) {
  revalidatePath("/business-pro/clients");
  revalidatePath("/business-pro/overview");
  revalidatePath("/business-pro/receivables");
  revalidatePath("/business-pro/invoicing");
  if (clientId) revalidatePath(`/business-pro/clients/${clientId}`);
}

export interface ClientInput {
  barnId: string;
  display_name: string;
  user_id?: string | null;
  email?: string | null;
  phone?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_postal?: string | null;
  address_country?: string | null;
  notes?: string | null;
}

export async function createClientAction(
  input: ClientInput,
): Promise<{ ok?: true; clientId?: string; error?: string }> {
  if (!input.barnId) return { error: "Barn is required" };
  if (!input.display_name?.trim()) return { error: "Name is required" };

  const auth = await requireBusinessProOwner(input.barnId);
  if ("error" in auth) return { error: auth.error };

  const payload = {
    barn_id: input.barnId,
    display_name: input.display_name.trim(),
    name_key: normalizeNameKey(input.display_name),
    user_id: input.user_id ?? null,
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    address_line1: input.address_line1?.trim() || null,
    address_line2: input.address_line2?.trim() || null,
    address_city: input.address_city?.trim() || null,
    address_state: input.address_state?.trim() || null,
    address_postal: input.address_postal?.trim() || null,
    address_country: input.address_country?.trim() || "US",
    notes: input.notes?.trim() || null,
    created_by_user_id: auth.userId,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (auth.supabase as any)
    .from("barn_clients")
    .insert(payload)
    .select("id")
    .single();
  if (error || !data) {
    if (error?.code === "23505") {
      return { error: "A client with that name already exists in this barn." };
    }
    return { error: error?.message ?? "Failed to create client" };
  }

  revalidateClients();
  return { ok: true, clientId: data.id as string };
}

export async function updateClientAction(
  clientId: string,
  patch: Partial<ClientInput>,
): Promise<{ ok?: true; error?: string }> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from("barn_clients")
    .select("barn_id")
    .eq("id", clientId)
    .maybeSingle();
  if (!existing) return { error: "Client not found" };

  const auth = await requireBusinessProOwner(existing.barn_id);
  if ("error" in auth) return { error: auth.error };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };
  if (patch.display_name !== undefined) {
    updates.display_name = patch.display_name.trim();
    updates.name_key = normalizeNameKey(patch.display_name);
  }
  if (patch.user_id !== undefined) updates.user_id = patch.user_id ?? null;
  if (patch.email !== undefined)
    updates.email = patch.email?.trim() || null;
  if (patch.phone !== undefined)
    updates.phone = patch.phone?.trim() || null;
  if (patch.address_line1 !== undefined)
    updates.address_line1 = patch.address_line1?.trim() || null;
  if (patch.address_line2 !== undefined)
    updates.address_line2 = patch.address_line2?.trim() || null;
  if (patch.address_city !== undefined)
    updates.address_city = patch.address_city?.trim() || null;
  if (patch.address_state !== undefined)
    updates.address_state = patch.address_state?.trim() || null;
  if (patch.address_postal !== undefined)
    updates.address_postal = patch.address_postal?.trim() || null;
  if (patch.address_country !== undefined)
    updates.address_country = patch.address_country?.trim() || "US";
  if (patch.notes !== undefined) updates.notes = patch.notes?.trim() || null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (auth.supabase as any)
    .from("barn_clients")
    .update(updates)
    .eq("id", clientId);
  if (error) return { error: error.message };

  revalidateClients(clientId);
  return { ok: true };
}

export async function archiveClientAction(
  clientId: string,
  archived = true,
): Promise<{ ok?: true; error?: string }> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from("barn_clients")
    .select("barn_id")
    .eq("id", clientId)
    .maybeSingle();
  if (!existing) return { error: "Client not found" };

  const auth = await requireBusinessProOwner(existing.barn_id);
  if ("error" in auth) return { error: auth.error };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (auth.supabase as any)
    .from("barn_clients")
    .update({ archived, updated_at: new Date().toISOString() })
    .eq("id", clientId);
  if (error) return { error: error.message };

  revalidateClients(clientId);
  return { ok: true };
}

export async function deleteClientAction(
  clientId: string,
): Promise<{ ok?: true; error?: string }> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from("barn_clients")
    .select("barn_id")
    .eq("id", clientId)
    .maybeSingle();
  if (!existing) return { error: "Client not found" };

  const auth = await requireBusinessProOwner(existing.barn_id);
  if ("error" in auth) return { error: auth.error };

  // Refuse if there are linked records — force the user to archive instead.
  for (const table of [
    "invoices",
    "activity_log",
    "health_records",
    "barn_expenses",
  ]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count } = await (auth.supabase as any)
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId);
    if ((count ?? 0) > 0) {
      return {
        error:
          "This client has linked invoices or entries. Archive instead of deleting to preserve history.",
      };
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (auth.supabase as any)
    .from("barn_clients")
    .delete()
    .eq("id", clientId);
  if (error) return { error: error.message };

  revalidateClients();
  return { ok: true };
}

// ──────────────────────────────────────────────────────────────
// Documents
// ──────────────────────────────────────────────────────────────

export interface NewClientDocumentInput {
  clientId: string;
  title: string;
  doc_type: string;
  custom_label?: string | null;
  // File metadata from client-side upload (the actual file is already in Storage)
  file_path: string;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  effective_date?: string | null;
  expiry_date?: string | null;
}

const ALLOWED_DOC_TYPES = new Set([
  "boarding_agreement",
  "training_contract",
  "waiver",
  "proposal",
  "w9",
  "other",
]);

/**
 * Finalize a document upload. The file has already been uploaded to Storage
 * by the browser via lib/client-documents.ts — this action writes the DB row.
 */
export async function createClientDocumentAction(
  input: NewClientDocumentInput,
): Promise<{ ok?: true; docId?: string; error?: string }> {
  if (!ALLOWED_DOC_TYPES.has(input.doc_type)) {
    return { error: "Invalid document type" };
  }
  if (!input.title?.trim()) return { error: "Title is required" };
  if (!input.file_path) return { error: "File upload did not complete" };

  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Look up barn_id via client
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: client } = await (supabase as any)
    .from("barn_clients")
    .select("barn_id")
    .eq("id", input.clientId)
    .maybeSingle();
  if (!client) return { error: "Client not found" };

  const auth = await requireBusinessProOwner(client.barn_id);
  if ("error" in auth) return { error: auth.error };

  const payload = {
    client_id: input.clientId,
    barn_id: client.barn_id,
    doc_type: input.doc_type,
    custom_label: input.custom_label?.trim() || null,
    title: input.title.trim(),
    file_path: input.file_path,
    file_name: input.file_name,
    file_size_bytes: input.file_size_bytes,
    mime_type: input.mime_type,
    effective_date: input.effective_date || null,
    expiry_date: input.expiry_date || null,
    uploaded_by_user_id: user.id,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (auth.supabase as any)
    .from("barn_client_documents")
    .insert(payload)
    .select("id")
    .single();
  if (error || !data) {
    return { error: error?.message ?? "Failed to save document" };
  }

  revalidateClients(input.clientId);
  return { ok: true, docId: data.id as string };
}

export async function deleteClientDocumentAction(
  docId: string,
): Promise<{ ok?: true; error?: string }> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: doc } = await (supabase as any)
    .from("barn_client_documents")
    .select("barn_id, client_id, file_path")
    .eq("id", docId)
    .maybeSingle();
  if (!doc) return { error: "Document not found" };

  const auth = await requireBusinessProOwner(doc.barn_id);
  if ("error" in auth) return { error: auth.error };

  // Best-effort Storage deletion — even if file is already gone, still delete
  // the DB row so the UI doesn't display a phantom entry.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (auth.supabase as any).storage
    .from(CLIENT_DOCUMENTS_BUCKET)
    .remove([doc.file_path]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (auth.supabase as any)
    .from("barn_client_documents")
    .delete()
    .eq("id", docId);
  if (error) return { error: error.message };

  revalidateClients(doc.client_id);
  return { ok: true };
}

/**
 * Return a 15-minute signed URL for downloading a client document.
 * Authorization is enforced both by this action (barn-owner check) and by
 * the Storage RLS policies on the client-documents bucket.
 */
export async function getClientDocumentSignedUrlAction(
  docId: string,
): Promise<{ url?: string; file_name?: string; error?: string }> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: doc } = await (supabase as any)
    .from("barn_client_documents")
    .select("barn_id, file_path, file_name")
    .eq("id", docId)
    .maybeSingle();
  if (!doc) return { error: "Document not found" };

  const auth = await requireBusinessProOwner(doc.barn_id);
  if ("error" in auth) return { error: auth.error };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (auth.supabase as any).storage
    .from(CLIENT_DOCUMENTS_BUCKET)
    .createSignedUrl(doc.file_path, 900);
  if (error || !data?.signedUrl) {
    return { error: error?.message ?? "Failed to generate download link" };
  }

  return { url: data.signedUrl as string, file_name: doc.file_name as string };
}
