import { redirect } from "next/navigation";
import { createServerComponentClient } from "@/lib/supabase-server";
import { ReceivablesClient } from "./ReceivablesClient";

type FinancialRow = {
  id: string;
  source: "activity" | "health";
  horse_id: string;
  barn_id: string | null;
  performed_at: string | null;
  created_at: string;
  activity_type?: string;
  record_type?: string;
  notes: string | null;
  total_cost: number | null;
  cost_type: "revenue" | "expense" | "pass_through" | null;
  client_id: string | null;
  billable_to_user_id: string | null;
  billable_to_name: string | null;
  payment_status: "unpaid" | "paid" | "partial" | "waived" | null;
  paid_amount: number | null;
  paid_at: string | null;
};

export default async function ReceivablesPage() {
  const supabase = await createServerComponentClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  // Fetch user's owned barns
  const { data: ownedBarns } = await supabase
    .from("barns")
    .select("id, name")
    .eq("owner_id", user.id);

  const barns = (ownedBarns ?? []) as { id: string; name: string }[];
  const barnIds = barns.map((b) => b.id);

  if (barnIds.length === 0) {
    return (
      <ReceivablesClient
        barns={[]}
        entries={[]}
        horseNames={{}}
        profileNames={{}}
        clientNames={{}}
        barnNames={{}}
        invoices={[]}
      />
    );
  }

  // Fetch horses in owned barns
  const { data: horses } = await supabase
    .from("horses")
    .select("id, name, barn_id")
    .in("barn_id", barnIds)
    .eq("archived", false);

  const horseRows = (horses ?? []) as { id: string; name: string; barn_id: string }[];
  const horseIds = horseRows.map((h) => h.id);
  const horseNames: Record<string, string> = {};
  const horseToBarn: Record<string, string> = {};
  const barnNames: Record<string, string> = {};
  for (const h of horseRows) {
    horseNames[h.id] = h.name;
    horseToBarn[h.id] = h.barn_id;
  }
  for (const b of barns) {
    barnNames[b.id] = b.name;
  }

  if (horseIds.length === 0) {
    return (
      <ReceivablesClient
        barns={barns}
        entries={[]}
        horseNames={horseNames}
        profileNames={{}}
        clientNames={{}}
        barnNames={barnNames}
        invoices={[]}
      />
    );
  }

  // Fetch ALL unpaid/partial revenue + pass_through entries that are NOT
  // already bundled onto an invoice (those are tracked at the invoice level).
  const [{ data: actUnpaid }, { data: healthUnpaid }] = await Promise.all([
    supabase
      .from("activity_log")
      .select("id, horse_id, activity_type, notes, performed_at, created_at, total_cost, cost_type, client_id, billable_to_user_id, billable_to_name, payment_status, paid_amount, paid_at")
      .in("horse_id", horseIds)
      .in("payment_status", ["unpaid", "partial"])
      .in("cost_type", ["revenue", "pass_through"])
      .is("invoice_id", null)
      .eq("status", "completed")
      .limit(5000),
    supabase
      .from("health_records")
      .select("id, horse_id, record_type, notes, performed_at, created_at, total_cost, cost_type, client_id, billable_to_user_id, billable_to_name, payment_status, paid_amount, paid_at")
      .in("horse_id", horseIds)
      .in("payment_status", ["unpaid", "partial"])
      .in("cost_type", ["revenue", "pass_through"])
      .is("invoice_id", null)
      .eq("status", "completed")
      .limit(5000),
  ]);

  // Fetch unpaid invoices (sent/partial) with computed overdue flag
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: unpaidInvoicesRaw } = await (supabase as any)
    .from("invoices")
    .select("id, barn_id, invoice_number, client_id, billable_to_user_id, billable_to_name, issue_date, due_date, status, subtotal, paid_amount, created_at")
    .in("barn_id", barnIds)
    .in("status", ["sent", "partial"])
    .order("issue_date", { ascending: true })
    .limit(2000);
  const today = new Date().toISOString().slice(0, 10);
  const unpaidInvoices = ((unpaidInvoicesRaw ?? []) as Record<string, unknown>[]).map((inv) => {
    const i = inv as unknown as { status: string; due_date: string | null };
    const displayStatus =
      (i.status === "sent" || i.status === "partial") && i.due_date && i.due_date < today
        ? "overdue"
        : i.status;
    return { ...inv, display_status: displayStatus };
  });

  const entries: FinancialRow[] = [];
  for (const e of (actUnpaid ?? []) as Record<string, unknown>[]) {
    entries.push({
      ...(e as unknown as FinancialRow),
      source: "activity",
      barn_id: horseToBarn[(e as { horse_id: string }).horse_id] ?? null,
    });
  }
  for (const e of (healthUnpaid ?? []) as Record<string, unknown>[]) {
    entries.push({
      ...(e as unknown as FinancialRow),
      source: "health",
      barn_id: horseToBarn[(e as { horse_id: string }).horse_id] ?? null,
    });
  }

  // Look up profile names for billable_to_user_id (entries + invoices)
  const billableUserIds = new Set<string>();
  for (const e of entries) {
    if (e.billable_to_user_id) billableUserIds.add(e.billable_to_user_id);
  }
  for (const inv of unpaidInvoices) {
    const i = inv as unknown as { billable_to_user_id: string | null };
    if (i.billable_to_user_id) billableUserIds.add(i.billable_to_user_id);
  }
  const profileNames: Record<string, string> = {};
  if (billableUserIds.size > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", [...billableUserIds]);
    for (const p of profiles ?? []) {
      profileNames[p.id] = p.full_name?.trim() || "Member";
    }
  }

  // Look up client names for entries + invoices stamped with client_id
  const clientIds = new Set<string>();
  for (const e of entries) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cId = (e as any).client_id as string | null;
    if (cId) clientIds.add(cId);
  }
  for (const inv of unpaidInvoices) {
    const i = inv as unknown as { client_id: string | null };
    if (i.client_id) clientIds.add(i.client_id);
  }
  const clientNames: Record<string, string> = {};
  if (clientIds.size > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: clientRows } = await (supabase as any)
      .from("barn_clients")
      .select("id, display_name")
      .in("id", [...clientIds]);
    for (const c of (clientRows ?? []) as { id: string; display_name: string }[]) {
      clientNames[c.id] = c.display_name;
    }
  }

  return (
    <ReceivablesClient
      barns={barns}
      entries={entries}
      horseNames={horseNames}
      profileNames={profileNames}
      clientNames={clientNames}
      barnNames={barnNames}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      invoices={unpaidInvoices as any[]}
    />
  );
}
