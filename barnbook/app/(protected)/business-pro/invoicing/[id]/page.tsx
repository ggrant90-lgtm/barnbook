import { notFound, redirect } from "next/navigation";
import { createServerComponentClient } from "@/lib/supabase-server";
import { InvoiceDetailClient } from "./InvoiceDetailClient";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerComponentClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: invoice } = await (supabase as any)
    .from("invoices")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!invoice) notFound();

  // Verify user owns the barn
  const { data: barn } = await supabase
    .from("barns")
    .select("id, name, owner_id")
    .eq("id", invoice.barn_id)
    .maybeSingle();
  if (!barn || barn.owner_id !== user.id) redirect("/business-pro/invoicing");

  // Fetch linked entries
  const [{ data: acts }, { data: healths }] = await Promise.all([
    supabase
      .from("activity_log")
      .select("id, horse_id, activity_type, notes, performed_at, created_at, total_cost, payment_status, paid_amount, paid_at")
      .eq("invoice_id", id),
    supabase
      .from("health_records")
      .select("id, horse_id, record_type, notes, performed_at, created_at, total_cost, payment_status, paid_amount, paid_at")
      .eq("invoice_id", id),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entries: any[] = [];
  for (const e of (acts ?? []) as Record<string, unknown>[]) {
    entries.push({ ...e, source: "activity" });
  }
  for (const e of (healths ?? []) as Record<string, unknown>[]) {
    entries.push({ ...e, source: "health" });
  }
  entries.sort((a, b) =>
    new Date(a.performed_at || a.created_at).getTime() -
    new Date(b.performed_at || b.created_at).getTime(),
  );

  // Horse names
  const horseIds = [...new Set(entries.map((e) => e.horse_id))];
  const horseNames: Record<string, string> = {};
  if (horseIds.length > 0) {
    const { data: horses } = await supabase
      .from("horses")
      .select("id, name")
      .in("id", horseIds);
    for (const h of horses ?? []) horseNames[h.id] = h.name;
  }

  // Also fetch addable entries (unpaid entries from same billable_to that
  // are NOT already on this or another invoice)
  let addable: Record<string, unknown>[] = [];
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const billableFilter = invoice.billable_to_user_id
      ? { col: "billable_to_user_id", val: invoice.billable_to_user_id }
      : invoice.billable_to_name
        ? { col: "billable_to_name", val: invoice.billable_to_name }
        : null;

    if (billableFilter) {
      // Get horses in this barn
      const { data: barnHorses } = await supabase
        .from("horses")
        .select("id, name")
        .eq("barn_id", invoice.barn_id)
        .eq("archived", false);
      const bhIds = (barnHorses ?? []).map((h) => h.id);
      for (const h of barnHorses ?? []) horseNames[h.id] = h.name;

      if (bhIds.length > 0) {
        const [{ data: actAdd }, { data: healthAdd }] = await Promise.all([
          supabase
            .from("activity_log")
            .select("id, horse_id, activity_type, notes, performed_at, created_at, total_cost")
            .in("horse_id", bhIds)
            .in("cost_type", ["revenue", "pass_through"])
            .in("payment_status", ["unpaid", "partial"])
            .is("invoice_id", null)
            .eq(billableFilter.col, billableFilter.val)
            .limit(200),
          supabase
            .from("health_records")
            .select("id, horse_id, record_type, notes, performed_at, created_at, total_cost")
            .in("horse_id", bhIds)
            .in("cost_type", ["revenue", "pass_through"])
            .in("payment_status", ["unpaid", "partial"])
            .is("invoice_id", null)
            .eq(billableFilter.col, billableFilter.val)
            .limit(200),
        ]);
        for (const e of (actAdd ?? []) as Record<string, unknown>[]) {
          addable.push({ ...e, source: "activity" });
        }
        for (const e of (healthAdd ?? []) as Record<string, unknown>[]) {
          addable.push({ ...e, source: "health" });
        }
      }
    }
  }

  // Client display name
  let clientName = invoice.billable_to_name ?? "Unassigned";
  if (invoice.billable_to_user_id) {
    const { data: p } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", invoice.billable_to_user_id)
      .maybeSingle();
    clientName = p?.full_name?.trim() || clientName;
  }

  return (
    <InvoiceDetailClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      invoice={invoice as any}
      barnName={barn.name}
      clientName={clientName}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      entries={entries as any[]}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      addableEntries={addable as any[]}
      horseNames={horseNames}
    />
  );
}
