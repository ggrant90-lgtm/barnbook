import { redirect } from "next/navigation";
import { createServerComponentClient } from "@/lib/supabase-server";
import { getOnboardingState } from "@/lib/onboarding-query";
import { BusinessProOnboardingLauncher } from "@/components/onboarding/BusinessProOnboardingLauncher";
import { OverviewClient } from "./OverviewClient";

type FinancialRow = {
  id: string;
  source: "activity" | "health" | "barn_expense";
  horse_id: string | null;
  performed_at: string | null;
  created_at: string;
  activity_type?: string;
  record_type?: string;
  category?: string | null;
  vendor_name?: string | null;
  notes: string | null;
  total_cost: number | null;
  cost_type: "revenue" | "expense" | "pass_through" | null;
  billable_to_user_id: string | null;
  billable_to_name: string | null;
  payment_status: "unpaid" | "paid" | "partial" | "waived" | null;
  paid_amount: number | null;
  paid_at: string | null;
  invoice_id: string | null;
};

export default async function BusinessProOverviewPage() {
  const supabase = await createServerComponentClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  // ── 1. Fetch user's owned barns ──
  const { data: ownedBarns } = await supabase
    .from("barns")
    .select("id, name, barn_type, plan_tier, company_name, company_phone, company_email")
    .eq("owner_id", user.id);

  const barns = (ownedBarns ?? []) as {
    id: string;
    name: string;
    barn_type: string | null;
    plan_tier: string | null;
    company_name: string | null;
    company_phone: string | null;
    company_email: string | null;
  }[];

  // Onboarding state + existing clients for the BP wizard launcher.
  const onboardingState = await getOnboardingState(supabase, user.id);
  const primaryBpBarn = barns[0] ?? null;
  const bpInitialCompany = primaryBpBarn
    ? {
        name:
          primaryBpBarn.company_name?.trim() ||
          primaryBpBarn.name,
        phone: primaryBpBarn.company_phone,
        email: primaryBpBarn.company_email,
      }
    : { name: "", phone: null, email: null };

  let existingBpClients: Array<{ id: string; display_name: string }> = [];
  if (primaryBpBarn) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: clientRows } = await (supabase as any)
      .from("barn_clients")
      .select("id, display_name")
      .eq("barn_id", primaryBpBarn.id)
      .eq("archived", false)
      .order("display_name", { ascending: true })
      .limit(50);
    existingBpClients = (clientRows ?? []) as Array<{
      id: string;
      display_name: string;
    }>;
  }
  if (barns.length === 0) {
    // Render with empty state — still render the wizard launcher so
    // it can decide (no-op when no barn).
    return (
      <>
        <BusinessProOnboardingLauncher
          barnId={null}
          onboardingState={onboardingState}
          initialCompany={bpInitialCompany}
          existingClients={existingBpClients}
        />
        <OverviewClient
          barns={[]}
          horseCountByBarn={{}}
          allEntries={[]}
          profileNames={{}}
          horseNames={{}}
          unpaidInvoices={[]}
          lineItemsForRevenue={[]}
        />
      </>
    );
  }

  const barnIds = barns.map((b) => b.id);

  // ── 2. Fetch horses in owned barns ──
  const { data: horses } = await supabase
    .from("horses")
    .select("id, name, barn_id")
    .in("barn_id", barnIds)
    .eq("archived", false);

  const horseRows = (horses ?? []) as { id: string; name: string; barn_id: string }[];
  const horseIds = horseRows.map((h) => h.id);
  const horseNames: Record<string, string> = {};
  const horseCountByBarn: Record<string, number> = {};
  const horseToBarn: Record<string, string> = {};
  for (const h of horseRows) {
    horseNames[h.id] = h.name;
    horseToBarn[h.id] = h.barn_id;
    horseCountByBarn[h.barn_id] = (horseCountByBarn[h.barn_id] ?? 0) + 1;
  }

  if (horseIds.length === 0) {
    return (
      <>
        <BusinessProOnboardingLauncher
          barnId={primaryBpBarn?.id ?? null}
          onboardingState={onboardingState}
          initialCompany={bpInitialCompany}
          existingClients={existingBpClients}
        />
        <OverviewClient
          barns={barns}
          horseCountByBarn={horseCountByBarn}
          allEntries={[]}
          profileNames={{}}
          horseNames={horseNames}
          unpaidInvoices={[]}
          lineItemsForRevenue={[]}
        />
      </>
    );
  }

  // ── 3. Fetch last 6 months of financial entries (activity_log + health_records) ──
  const now = new Date();
  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const sinceISO = sixMonthsAgo.toISOString();

  const [{ data: actEntries }, { data: healthEntries }] = await Promise.all([
    supabase
      .from("activity_log")
      .select("id, horse_id, activity_type, notes, performed_at, created_at, total_cost, cost_type, billable_to_user_id, billable_to_name, payment_status, paid_amount, paid_at, invoice_id")
      .in("horse_id", horseIds)
      .not("cost_type", "is", null)
      .eq("status", "completed")
      .or(`performed_at.gte.${sinceISO},created_at.gte.${sinceISO}`)
      .order("created_at", { ascending: false })
      .limit(5000),
    supabase
      .from("health_records")
      .select("id, horse_id, record_type, notes, performed_at, created_at, total_cost, cost_type, billable_to_user_id, billable_to_name, payment_status, paid_amount, paid_at, invoice_id")
      .in("horse_id", horseIds)
      .not("cost_type", "is", null)
      .eq("status", "completed")
      .or(`performed_at.gte.${sinceISO},created_at.gte.${sinceISO}`)
      .order("created_at", { ascending: false })
      .limit(5000),
  ]);

  // ── 3b. Fetch last 6 months of barn-level expenses ──
  // These aren't tied to a horse; pulled directly by barn_id.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: barnExpenses } = await (supabase as any)
    .from("barn_expenses")
    .select("id, barn_id, category, vendor_name, description, notes, performed_at, created_at, total_cost, cost_type, billable_to_user_id, billable_to_name, payment_status, paid_amount, paid_at, invoice_id")
    .in("barn_id", barnIds)
    .not("cost_type", "is", null)
    .or(`performed_at.gte.${sinceISO},created_at.gte.${sinceISO}`)
    .order("performed_at", { ascending: false })
    .limit(5000);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: barnExpensesUnpaid } = await (supabase as any)
    .from("barn_expenses")
    .select("id, barn_id, category, vendor_name, description, notes, performed_at, created_at, total_cost, cost_type, billable_to_user_id, billable_to_name, payment_status, paid_amount, paid_at, invoice_id")
    .in("barn_id", barnIds)
    .in("payment_status", ["unpaid", "partial"])
    .is("invoice_id", null)
    .limit(5000);

  // Also fetch ALL unpaid entries regardless of date (for accurate AR total)
  // IMPORTANT: filter out entries that are bundled onto an invoice — those
  // are tracked at the invoice level (see invoices query below) so we don't
  // double-count.
  const [{ data: actUnpaid }, { data: healthUnpaid }] = await Promise.all([
    supabase
      .from("activity_log")
      .select("id, horse_id, activity_type, notes, performed_at, created_at, total_cost, cost_type, billable_to_user_id, billable_to_name, payment_status, paid_amount, paid_at, invoice_id")
      .in("horse_id", horseIds)
      .in("payment_status", ["unpaid", "partial"])
      .is("invoice_id", null)
      .eq("status", "completed")
      .limit(5000),
    supabase
      .from("health_records")
      .select("id, horse_id, record_type, notes, performed_at, created_at, total_cost, cost_type, billable_to_user_id, billable_to_name, payment_status, paid_amount, paid_at, invoice_id")
      .in("horse_id", horseIds)
      .in("payment_status", ["unpaid", "partial"])
      .is("invoice_id", null)
      .eq("status", "completed")
      .limit(5000),
  ]);

  // Fetch unpaid invoices (sent/partial/overdue) — these are the authoritative
  // receivables for anything that's been invoiced.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: unpaidInvoicesRaw } = await (supabase as any)
    .from("invoices")
    .select("id, barn_id, invoice_number, billable_to_user_id, billable_to_name, issue_date, due_date, status, subtotal, paid_amount, created_at")
    .in("barn_id", barnIds)
    .in("status", ["sent", "partial"])
    .order("issue_date", { ascending: true })
    .limit(2000);

  // Fetch ALL billed invoices (sent/partial/paid) in the last 6 months so
  // their custom line items flow into the Revenue calc at invoice issue_date.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: billedInvoicesForRevenueRaw } = await (supabase as any)
    .from("invoices")
    .select("id, barn_id, issue_date, status")
    .in("barn_id", barnIds)
    .in("status", ["sent", "partial", "paid"])
    .gte("issue_date", sinceISO.slice(0, 10))
    .limit(2000);
  const billedInvoiceIds = ((billedInvoicesForRevenueRaw ?? []) as { id: string }[]).map((i) => i.id);
  const billedInvoiceMetaById: Record<string, { issue_date: string; barn_id: string }> = {};
  for (const inv of (billedInvoicesForRevenueRaw ?? []) as { id: string; issue_date: string; barn_id: string }[]) {
    billedInvoiceMetaById[inv.id] = { issue_date: inv.issue_date, barn_id: inv.barn_id };
  }

  // Fetch line items for those invoices
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: invoiceLineItems } = billedInvoiceIds.length > 0
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? await (supabase as any)
        .from("invoice_line_items")
        .select("id, invoice_id, amount")
        .in("invoice_id", billedInvoiceIds)
        .limit(5000)
    : { data: [] };

  // Tag each line item with its invoice's issue_date + barn_id for
  // client-side grouping and per-barn breakdowns
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lineItemsForRevenue = ((invoiceLineItems ?? []) as any[])
    .map((li) => {
      const meta = billedInvoiceMetaById[li.invoice_id as string];
      return {
        id: li.id as string,
        amount: (li.amount as number | null) ?? 0,
        issue_date: meta?.issue_date ?? null,
        barn_id: meta?.barn_id ?? null,
      };
    })
    .filter((li) => li.issue_date);

  // Compute display_status (overdue) for invoices past due date
  const today = new Date().toISOString().slice(0, 10);
  const unpaidInvoices = ((unpaidInvoicesRaw ?? []) as Record<string, unknown>[]).map((inv) => {
    const i = inv as unknown as { status: string; due_date: string | null };
    const displayStatus =
      (i.status === "sent" || i.status === "partial") && i.due_date && i.due_date < today
        ? "overdue"
        : i.status;
    return { ...inv, display_status: displayStatus };
  });

  // Merge, tag with source, dedupe by id
  const allEntriesMap = new Map<string, FinancialRow>();
  for (const e of (actEntries ?? []) as Record<string, unknown>[]) {
    allEntriesMap.set(`a-${e.id}`, { ...e, source: "activity" } as FinancialRow);
  }
  for (const e of (healthEntries ?? []) as Record<string, unknown>[]) {
    allEntriesMap.set(`h-${e.id}`, { ...e, source: "health" } as FinancialRow);
  }
  for (const e of (actUnpaid ?? []) as Record<string, unknown>[]) {
    allEntriesMap.set(`a-${e.id}`, { ...e, source: "activity" } as FinancialRow);
  }
  for (const e of (healthUnpaid ?? []) as Record<string, unknown>[]) {
    allEntriesMap.set(`h-${e.id}`, { ...e, source: "health" } as FinancialRow);
  }
  // Barn-level expenses (no horse_id)
  for (const e of (barnExpenses ?? []) as Record<string, unknown>[]) {
    allEntriesMap.set(`be-${e.id}`, {
      ...e,
      source: "barn_expense",
      horse_id: null,
    } as FinancialRow);
  }
  for (const e of (barnExpensesUnpaid ?? []) as Record<string, unknown>[]) {
    allEntriesMap.set(`be-${e.id}`, {
      ...e,
      source: "barn_expense",
      horse_id: null,
    } as FinancialRow);
  }
  const allEntries = Array.from(allEntriesMap.values());

  // ── 4. Look up billable-to profile names (entries + invoices) ──
  const billableUserIds = new Set<string>();
  for (const e of allEntries) {
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

  return (
    <>
      <BusinessProOnboardingLauncher
        barnId={primaryBpBarn?.id ?? null}
        onboardingState={onboardingState}
        initialCompany={bpInitialCompany}
        existingClients={existingBpClients}
      />
      <OverviewClient
      barns={barns}
      horseCountByBarn={horseCountByBarn}
      allEntries={allEntries.map((e) => {
        // Barn expenses already have barn_id; horse-linked entries derive it
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const existingBarnId = (e as any).barn_id as string | null | undefined;
        return {
          ...e,
          barn_id:
            existingBarnId ?? (e.horse_id ? horseToBarn[e.horse_id] : null) ?? null,
        };
      })}
      profileNames={profileNames}
      horseNames={horseNames}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      unpaidInvoices={unpaidInvoices as any[]}
      lineItemsForRevenue={lineItemsForRevenue}
    />
    </>
  );
}
