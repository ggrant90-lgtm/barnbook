import { redirect } from "next/navigation";
import { createServerComponentClient } from "@/lib/supabase-server";
import { OverviewClient } from "./OverviewClient";

type FinancialRow = {
  id: string;
  source: "activity" | "health";
  horse_id: string;
  performed_at: string | null;
  created_at: string;
  activity_type?: string;
  record_type?: string;
  notes: string | null;
  total_cost: number | null;
  cost_type: "revenue" | "expense" | "pass_through" | null;
  billable_to_user_id: string | null;
  billable_to_name: string | null;
  payment_status: "unpaid" | "paid" | "partial" | "waived" | null;
  paid_amount: number | null;
  paid_at: string | null;
};

export default async function BusinessProOverviewPage() {
  const supabase = await createServerComponentClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  // ── 1. Fetch user's owned barns ──
  const { data: ownedBarns } = await supabase
    .from("barns")
    .select("id, name, barn_type, plan_tier")
    .eq("owner_id", user.id);

  const barns = (ownedBarns ?? []) as { id: string; name: string; barn_type: string | null; plan_tier: string | null }[];
  if (barns.length === 0) {
    // Render with empty state
    return (
      <OverviewClient
        barns={[]}
        horseCountByBarn={{}}
        allEntries={[]}
        profileNames={{}}
        horseNames={{}}
      />
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
      <OverviewClient
        barns={barns}
        horseCountByBarn={horseCountByBarn}
        allEntries={[]}
        profileNames={{}}
        horseNames={horseNames}
      />
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
      .select("id, horse_id, activity_type, notes, performed_at, created_at, total_cost, cost_type, billable_to_user_id, billable_to_name, payment_status, paid_amount, paid_at")
      .in("horse_id", horseIds)
      .not("cost_type", "is", null)
      .or(`performed_at.gte.${sinceISO},created_at.gte.${sinceISO}`)
      .order("created_at", { ascending: false })
      .limit(5000),
    supabase
      .from("health_records")
      .select("id, horse_id, record_type, notes, performed_at, created_at, total_cost, cost_type, billable_to_user_id, billable_to_name, payment_status, paid_amount, paid_at")
      .in("horse_id", horseIds)
      .not("cost_type", "is", null)
      .or(`performed_at.gte.${sinceISO},created_at.gte.${sinceISO}`)
      .order("created_at", { ascending: false })
      .limit(5000),
  ]);

  // Also fetch ALL unpaid entries regardless of date (for accurate AR total)
  const [{ data: actUnpaid }, { data: healthUnpaid }] = await Promise.all([
    supabase
      .from("activity_log")
      .select("id, horse_id, activity_type, notes, performed_at, created_at, total_cost, cost_type, billable_to_user_id, billable_to_name, payment_status, paid_amount, paid_at")
      .in("horse_id", horseIds)
      .in("payment_status", ["unpaid", "partial"])
      .limit(5000),
    supabase
      .from("health_records")
      .select("id, horse_id, record_type, notes, performed_at, created_at, total_cost, cost_type, billable_to_user_id, billable_to_name, payment_status, paid_amount, paid_at")
      .in("horse_id", horseIds)
      .in("payment_status", ["unpaid", "partial"])
      .limit(5000),
  ]);

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
  const allEntries = Array.from(allEntriesMap.values());

  // ── 4. Look up billable-to profile names ──
  const billableUserIds = new Set<string>();
  for (const e of allEntries) {
    if (e.billable_to_user_id) billableUserIds.add(e.billable_to_user_id);
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
    <OverviewClient
      barns={barns}
      horseCountByBarn={horseCountByBarn}
      allEntries={allEntries.map((e) => ({ ...e, barn_id: horseToBarn[e.horse_id] ?? null }))}
      profileNames={profileNames}
      horseNames={horseNames}
    />
  );
}
