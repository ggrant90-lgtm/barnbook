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
        barnNames={{}}
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
        barnNames={barnNames}
      />
    );
  }

  // Fetch ALL unpaid/partial revenue + pass_through entries (no date limit — AR is forever until paid)
  const [{ data: actUnpaid }, { data: healthUnpaid }] = await Promise.all([
    supabase
      .from("activity_log")
      .select("id, horse_id, activity_type, notes, performed_at, created_at, total_cost, cost_type, billable_to_user_id, billable_to_name, payment_status, paid_amount, paid_at")
      .in("horse_id", horseIds)
      .in("payment_status", ["unpaid", "partial"])
      .in("cost_type", ["revenue", "pass_through"])
      .limit(5000),
    supabase
      .from("health_records")
      .select("id, horse_id, record_type, notes, performed_at, created_at, total_cost, cost_type, billable_to_user_id, billable_to_name, payment_status, paid_amount, paid_at")
      .in("horse_id", horseIds)
      .in("payment_status", ["unpaid", "partial"])
      .in("cost_type", ["revenue", "pass_through"])
      .limit(5000),
  ]);

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

  // Look up profile names for billable_to_user_id
  const billableUserIds = new Set<string>();
  for (const e of entries) {
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
    <ReceivablesClient
      barns={barns}
      entries={entries}
      horseNames={horseNames}
      profileNames={profileNames}
      barnNames={barnNames}
    />
  );
}
