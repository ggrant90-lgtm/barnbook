"use server";

import { createServerComponentClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

type Source = "activity" | "health";

/** Guard: require Business Pro + barn owner. */
async function requireBusinessProOwner(barnId: string) {
  const supabase = await createServerComponentClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" as const };

  const { data: profile } = await supabase
    .from("profiles")
    .select("has_business_pro")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.has_business_pro) return { error: "Business Pro required" as const };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: barn } = await (supabase as any)
    .from("barns")
    .select("owner_id")
    .eq("id", barnId)
    .maybeSingle();
  if (!barn || barn.owner_id !== user.id) {
    return { error: "Must be the barn owner to manage invoices" as const };
  }

  return { supabase, userId: user.id };
}

/** Generate the next invoice number for a barn (prefix + zero-padded seq). */
async function nextInvoiceNumber(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  barnId: string,
): Promise<string> {
  const { data: barn } = await supabase
    .from("barns")
    .select("next_invoice_seq, name")
    .eq("id", barnId)
    .maybeSingle();
  const seq = (barn?.next_invoice_seq as number | undefined) ?? 1;

  // Increment
  await supabase
    .from("barns")
    .update({ next_invoice_seq: seq + 1 })
    .eq("id", barnId);

  const year = new Date().getFullYear();
  return `INV-${year}-${String(seq).padStart(4, "0")}`;
}

/** Recompute subtotal from linked entries + custom line items. */
async function recomputeSubtotal(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  invoiceId: string,
): Promise<number> {
  const [{ data: act }, { data: health }, { data: lines }] = await Promise.all([
    supabase.from("activity_log").select("total_cost").eq("invoice_id", invoiceId),
    supabase.from("health_records").select("total_cost").eq("invoice_id", invoiceId),
    supabase.from("invoice_line_items").select("amount").eq("invoice_id", invoiceId),
  ]);
  const sum =
    ((act ?? []) as { total_cost: number | null }[]).reduce((s, e) => s + (e.total_cost ?? 0), 0) +
    ((health ?? []) as { total_cost: number | null }[]).reduce((s, e) => s + (e.total_cost ?? 0), 0) +
    ((lines ?? []) as { amount: number | null }[]).reduce((s, l) => s + (l.amount ?? 0), 0);

  await supabase.from("invoices").update({ subtotal: sum, updated_at: new Date().toISOString() }).eq("id", invoiceId);
  return sum;
}

// ──────────────────────────────────────────────────────────────────────────
// CREATE
// ──────────────────────────────────────────────────────────────────────────

export async function createInvoiceAction(input: {
  barnId: string;
  billable_to_user_id?: string | null;
  billable_to_name?: string | null;
  due_date?: string | null;
  notes?: string | null;
  terms?: string | null;
  entryIds: { id: string; source: Source }[];
}): Promise<{ ok?: true; invoiceId?: string; error?: string }> {
  const auth = await requireBusinessProOwner(input.barnId);
  if ("error" in auth) return { error: auth.error };
  const { supabase, userId } = auth;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  // Pull barn branding defaults to snapshot
  const { data: barn } = await db
    .from("barns")
    .select("logo_url, company_name, company_address, company_phone, company_email, invoice_notes_default, invoice_terms_default")
    .eq("id", input.barnId)
    .maybeSingle();

  const invoiceNumber = await nextInvoiceNumber(db, input.barnId);

  const { data: invoice, error } = await db
    .from("invoices")
    .insert({
      barn_id: input.barnId,
      invoice_number: invoiceNumber,
      billable_to_user_id: input.billable_to_user_id ?? null,
      billable_to_name: input.billable_to_name ?? null,
      due_date: input.due_date ?? null,
      status: "draft",
      notes: input.notes ?? barn?.invoice_notes_default ?? null,
      terms: input.terms ?? barn?.invoice_terms_default ?? null,
      logo_url: barn?.logo_url ?? null,
      company_name: barn?.company_name ?? null,
      company_address: barn?.company_address ?? null,
      company_phone: barn?.company_phone ?? null,
      company_email: barn?.company_email ?? null,
      created_by_user_id: userId,
    })
    .select("id")
    .single();

  if (error || !invoice) return { error: error?.message ?? "Failed to create invoice" };

  // Link entries
  const invoiceId = invoice.id as string;
  const actIds = input.entryIds.filter((e) => e.source === "activity").map((e) => e.id);
  const healthIds = input.entryIds.filter((e) => e.source === "health").map((e) => e.id);

  if (actIds.length > 0) {
    await db.from("activity_log").update({ invoice_id: invoiceId }).in("id", actIds);
  }
  if (healthIds.length > 0) {
    await db.from("health_records").update({ invoice_id: invoiceId }).in("id", healthIds);
  }

  await recomputeSubtotal(db, invoiceId);

  revalidatePath("/business-pro/invoicing");
  revalidatePath("/business-pro/overview");
  revalidatePath("/business-pro/receivables");
  return { ok: true, invoiceId };
}

// ──────────────────────────────────────────────────────────────────────────
// UPDATE metadata
// ──────────────────────────────────────────────────────────────────────────

export async function updateInvoiceAction(
  invoiceId: string,
  patch: {
    due_date?: string | null;
    notes?: string | null;
    terms?: string | null;
    billable_to_user_id?: string | null;
    billable_to_name?: string | null;
  },
): Promise<{ ok?: true; error?: string }> {
  const supabase = await createServerComponentClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inv } = await (supabase as any)
    .from("invoices")
    .select("barn_id")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!inv) return { error: "Invoice not found" };

  const auth = await requireBusinessProOwner(inv.barn_id);
  if ("error" in auth) return { error: auth.error };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("invoices")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", invoiceId);
  if (error) return { error: error.message };

  revalidatePath(`/business-pro/invoicing/${invoiceId}`);
  revalidatePath("/business-pro/invoicing");
  return { ok: true };
}

// ──────────────────────────────────────────────────────────────────────────
// ADD / REMOVE entries
// ──────────────────────────────────────────────────────────────────────────

export async function addEntriesToInvoiceAction(
  invoiceId: string,
  entries: { id: string; source: Source }[],
): Promise<{ ok?: true; error?: string }> {
  const supabase = await createServerComponentClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inv } = await (supabase as any)
    .from("invoices")
    .select("barn_id")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!inv) return { error: "Invoice not found" };
  const auth = await requireBusinessProOwner(inv.barn_id);
  if ("error" in auth) return { error: auth.error };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const actIds = entries.filter((e) => e.source === "activity").map((e) => e.id);
  const healthIds = entries.filter((e) => e.source === "health").map((e) => e.id);
  if (actIds.length > 0) {
    await db.from("activity_log").update({ invoice_id: invoiceId }).in("id", actIds);
  }
  if (healthIds.length > 0) {
    await db.from("health_records").update({ invoice_id: invoiceId }).in("id", healthIds);
  }

  await recomputeSubtotal(db, invoiceId);
  revalidatePath(`/business-pro/invoicing/${invoiceId}`);
  return { ok: true };
}

export async function removeEntriesFromInvoiceAction(
  invoiceId: string,
  entries: { id: string; source: Source }[],
): Promise<{ ok?: true; error?: string }> {
  const supabase = await createServerComponentClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inv } = await (supabase as any)
    .from("invoices")
    .select("barn_id")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!inv) return { error: "Invoice not found" };
  const auth = await requireBusinessProOwner(inv.barn_id);
  if ("error" in auth) return { error: auth.error };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const actIds = entries.filter((e) => e.source === "activity").map((e) => e.id);
  const healthIds = entries.filter((e) => e.source === "health").map((e) => e.id);
  if (actIds.length > 0) {
    await db.from("activity_log").update({ invoice_id: null }).in("id", actIds);
  }
  if (healthIds.length > 0) {
    await db.from("health_records").update({ invoice_id: null }).in("id", healthIds);
  }

  await recomputeSubtotal(db, invoiceId);
  revalidatePath(`/business-pro/invoicing/${invoiceId}`);
  return { ok: true };
}

// ──────────────────────────────────────────────────────────────────────────
// LIFECYCLE — send, mark paid, void
// ──────────────────────────────────────────────────────────────────────────

export async function sendInvoiceAction(invoiceId: string): Promise<{ ok?: true; error?: string }> {
  const supabase = await createServerComponentClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inv } = await (supabase as any)
    .from("invoices")
    .select("barn_id, status")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!inv) return { error: "Invoice not found" };
  const auth = await requireBusinessProOwner(inv.barn_id);
  if ("error" in auth) return { error: auth.error };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("invoices")
    .update({ status: "sent", sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", invoiceId);
  if (error) return { error: error.message };

  revalidatePath(`/business-pro/invoicing/${invoiceId}`);
  revalidatePath("/business-pro/invoicing");
  return { ok: true };
}

/** Mark invoice as fully paid — cascades to all linked entries. */
export async function markInvoicePaidAction(invoiceId: string): Promise<{ ok?: true; error?: string }> {
  const supabase = await createServerComponentClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inv } = await (supabase as any)
    .from("invoices")
    .select("barn_id, subtotal")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!inv) return { error: "Invoice not found" };
  const auth = await requireBusinessProOwner(inv.barn_id);
  if ("error" in auth) return { error: auth.error };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const nowIso = new Date().toISOString();

  // Mark invoice paid
  await db
    .from("invoices")
    .update({ status: "paid", paid_at: nowIso, paid_amount: inv.subtotal, updated_at: nowIso })
    .eq("id", invoiceId);

  // Cascade to all linked entries — each entry's paid_amount = its total_cost
  const [{ data: acts }, { data: healths }] = await Promise.all([
    db.from("activity_log").select("id, total_cost").eq("invoice_id", invoiceId),
    db.from("health_records").select("id, total_cost").eq("invoice_id", invoiceId),
  ]);

  for (const e of (acts ?? []) as { id: string; total_cost: number | null }[]) {
    await db
      .from("activity_log")
      .update({ payment_status: "paid", paid_amount: e.total_cost, paid_at: nowIso })
      .eq("id", e.id);
  }
  for (const e of (healths ?? []) as { id: string; total_cost: number | null }[]) {
    await db
      .from("health_records")
      .update({ payment_status: "paid", paid_amount: e.total_cost, paid_at: nowIso })
      .eq("id", e.id);
  }

  revalidatePath(`/business-pro/invoicing/${invoiceId}`);
  revalidatePath("/business-pro/invoicing");
  revalidatePath("/business-pro/overview");
  revalidatePath("/business-pro/receivables");
  return { ok: true };
}

/** Void an invoice — unlinks all entries back to standalone state. */
export async function voidInvoiceAction(invoiceId: string): Promise<{ ok?: true; error?: string }> {
  const supabase = await createServerComponentClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inv } = await (supabase as any)
    .from("invoices")
    .select("barn_id")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!inv) return { error: "Invoice not found" };
  const auth = await requireBusinessProOwner(inv.barn_id);
  if ("error" in auth) return { error: auth.error };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  // Unlink all entries first so they return to AR tracking
  await db.from("activity_log").update({ invoice_id: null }).eq("invoice_id", invoiceId);
  await db.from("health_records").update({ invoice_id: null }).eq("invoice_id", invoiceId);

  await db
    .from("invoices")
    .update({ status: "void", updated_at: new Date().toISOString() })
    .eq("id", invoiceId);

  revalidatePath(`/business-pro/invoicing/${invoiceId}`);
  revalidatePath("/business-pro/invoicing");
  revalidatePath("/business-pro/receivables");
  return { ok: true };
}

/** Delete a draft invoice. Cannot delete sent/paid invoices — void them instead. */
export async function deleteInvoiceAction(invoiceId: string): Promise<{ ok?: true; error?: string }> {
  const supabase = await createServerComponentClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inv } = await (supabase as any)
    .from("invoices")
    .select("barn_id, status")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!inv) return { error: "Invoice not found" };
  if (inv.status !== "draft") return { error: "Only draft invoices can be deleted. Void this one instead." };
  const auth = await requireBusinessProOwner(inv.barn_id);
  if ("error" in auth) return { error: auth.error };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  // Unlink entries (they return to AR)
  await db.from("activity_log").update({ invoice_id: null }).eq("invoice_id", invoiceId);
  await db.from("health_records").update({ invoice_id: null }).eq("invoice_id", invoiceId);

  const { error } = await db.from("invoices").delete().eq("id", invoiceId);
  if (error) return { error: error.message };

  revalidatePath("/business-pro/invoicing");
  revalidatePath("/business-pro/receivables");
  return { ok: true };
}

// ──────────────────────────────────────────────────────────────────────────
// Barn branding settings
// ──────────────────────────────────────────────────────────────────────────

// ──────────────────────────────────────────────────────────────────────────
// Custom line items (non-log-entry charges — board, adjustments, etc.)
// ──────────────────────────────────────────────────────────────────────────

async function getInvoiceBarn(invoiceId: string): Promise<string | null> {
  const supabase = await createServerComponentClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("invoices")
    .select("barn_id")
    .eq("id", invoiceId)
    .maybeSingle();
  return (data?.barn_id as string | undefined) ?? null;
}

export async function addInvoiceLineItemAction(
  invoiceId: string,
  input: {
    description: string;
    quantity?: number;
    unit_price: number;
    horse_id?: string | null;
  },
): Promise<{ ok?: true; lineItemId?: string; error?: string }> {
  const barnId = await getInvoiceBarn(invoiceId);
  if (!barnId) return { error: "Invoice not found" };
  const auth = await requireBusinessProOwner(barnId);
  if ("error" in auth) return { error: auth.error };
  const { supabase } = auth;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const quantity = input.quantity != null ? Number(input.quantity) : 1;
  const unit_price = Number(input.unit_price);
  const amount = quantity * unit_price;

  if (!input.description.trim()) return { error: "Description is required" };
  if (!Number.isFinite(amount)) return { error: "Invalid amount" };

  // Next sort_order for this invoice
  const { data: existing } = await db
    .from("invoice_line_items")
    .select("sort_order")
    .eq("invoice_id", invoiceId)
    .order("sort_order", { ascending: false })
    .limit(1);
  const nextSort = existing && existing.length > 0 ? (existing[0].sort_order ?? 0) + 1 : 0;

  const { data, error } = await db
    .from("invoice_line_items")
    .insert({
      invoice_id: invoiceId,
      description: input.description.trim(),
      quantity,
      unit_price,
      amount,
      horse_id: input.horse_id ?? null,
      sort_order: nextSort,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  await recomputeSubtotal(db, invoiceId);
  revalidatePath(`/business-pro/invoicing/${invoiceId}`);
  return { ok: true, lineItemId: data.id as string };
}

export async function updateInvoiceLineItemAction(
  lineItemId: string,
  patch: {
    description?: string;
    quantity?: number;
    unit_price?: number;
    horse_id?: string | null;
  },
): Promise<{ ok?: true; error?: string }> {
  const supabase = await createServerComponentClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data: existing } = await db
    .from("invoice_line_items")
    .select("invoice_id, quantity, unit_price")
    .eq("id", lineItemId)
    .maybeSingle();
  if (!existing) return { error: "Line item not found" };

  const auth = await requireBusinessProOwner((await getInvoiceBarn(existing.invoice_id)) ?? "");
  if ("error" in auth) return { error: auth.error };

  const update: Record<string, unknown> = {};
  if (patch.description !== undefined) update.description = patch.description.trim();
  if (patch.horse_id !== undefined) update.horse_id = patch.horse_id;

  const quantity = patch.quantity !== undefined ? Number(patch.quantity) : Number(existing.quantity);
  const unit_price = patch.unit_price !== undefined ? Number(patch.unit_price) : Number(existing.unit_price);
  if (patch.quantity !== undefined) update.quantity = quantity;
  if (patch.unit_price !== undefined) update.unit_price = unit_price;
  if (patch.quantity !== undefined || patch.unit_price !== undefined) {
    update.amount = quantity * unit_price;
  }

  const { error } = await db.from("invoice_line_items").update(update).eq("id", lineItemId);
  if (error) return { error: error.message };

  await recomputeSubtotal(db, existing.invoice_id);
  revalidatePath(`/business-pro/invoicing/${existing.invoice_id}`);
  return { ok: true };
}

export async function removeInvoiceLineItemAction(
  lineItemId: string,
): Promise<{ ok?: true; error?: string }> {
  const supabase = await createServerComponentClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data: existing } = await db
    .from("invoice_line_items")
    .select("invoice_id")
    .eq("id", lineItemId)
    .maybeSingle();
  if (!existing) return { error: "Line item not found" };

  const auth = await requireBusinessProOwner((await getInvoiceBarn(existing.invoice_id)) ?? "");
  if ("error" in auth) return { error: auth.error };

  const { error } = await db.from("invoice_line_items").delete().eq("id", lineItemId);
  if (error) return { error: error.message };

  await recomputeSubtotal(db, existing.invoice_id);
  revalidatePath(`/business-pro/invoicing/${existing.invoice_id}`);
  return { ok: true };
}

export async function updateBarnInvoiceSettingsAction(
  barnId: string,
  patch: {
    logo_url?: string | null;
    company_name?: string | null;
    company_address?: string | null;
    company_phone?: string | null;
    company_email?: string | null;
    invoice_notes_default?: string | null;
    invoice_terms_default?: string | null;
  },
): Promise<{ ok?: true; error?: string }> {
  const auth = await requireBusinessProOwner(barnId);
  if ("error" in auth) return { error: auth.error };
  const { supabase } = auth;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("barns")
    .update(patch)
    .eq("id", barnId);
  if (error) return { error: error.message };

  revalidatePath("/business-pro/invoicing/settings");
  return { ok: true };
}
