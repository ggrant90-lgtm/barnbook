import { redirect } from "next/navigation";
import { createServerComponentClient } from "@/lib/supabase-server";
import { NewInvoiceClient } from "./NewInvoiceClient";

export default async function NewInvoicePage() {
  const supabase = await createServerComponentClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  // Only barns the user owns (invoice creation requires ownership)
  const { data: ownedBarns } = await supabase
    .from("barns")
    .select("id, name")
    .eq("owner_id", user.id);
  const barns = (ownedBarns ?? []) as { id: string; name: string }[];
  const barnIds = barns.map((b) => b.id);

  if (barnIds.length === 0) {
    redirect("/business-pro");
  }

  // Fetch horses in those barns
  const { data: horses } = await supabase
    .from("horses")
    .select("id, name, barn_id")
    .in("barn_id", barnIds)
    .eq("archived", false);
  const horseRows = (horses ?? []) as { id: string; name: string; barn_id: string }[];
  const horseIds = horseRows.map((h) => h.id);

  // Fetch ALL unpaid revenue/pass_through entries that are NOT already on an invoice
  const [{ data: actEntries }, { data: healthEntries }] = await Promise.all([
    supabase
      .from("activity_log")
      .select("id, horse_id, activity_type, notes, performed_at, created_at, total_cost, cost_type, billable_to_user_id, billable_to_name, payment_status, invoice_id")
      .in("horse_id", horseIds.length > 0 ? horseIds : ["__none__"])
      .in("cost_type", ["revenue", "pass_through"])
      .in("payment_status", ["unpaid", "partial"])
      .is("invoice_id", null)
      .limit(5000),
    supabase
      .from("health_records")
      .select("id, horse_id, record_type, notes, performed_at, created_at, total_cost, cost_type, billable_to_user_id, billable_to_name, payment_status, invoice_id")
      .in("horse_id", horseIds.length > 0 ? horseIds : ["__none__"])
      .in("cost_type", ["revenue", "pass_through"])
      .in("payment_status", ["unpaid", "partial"])
      .is("invoice_id", null)
      .limit(5000),
  ]);

  const horseNames: Record<string, string> = {};
  const horseToBarn: Record<string, string> = {};
  const barnNames: Record<string, string> = {};
  for (const h of horseRows) {
    horseNames[h.id] = h.name;
    horseToBarn[h.id] = h.barn_id;
  }
  for (const b of barns) barnNames[b.id] = b.name;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entries: any[] = [];
  for (const e of (actEntries ?? []) as Record<string, unknown>[]) {
    entries.push({ ...e, source: "activity", barn_id: horseToBarn[(e as { horse_id: string }).horse_id] ?? null });
  }
  for (const e of (healthEntries ?? []) as Record<string, unknown>[]) {
    entries.push({ ...e, source: "health", barn_id: horseToBarn[(e as { horse_id: string }).horse_id] ?? null });
  }

  // Look up profile names for billable_to_user_id
  const userIds = new Set<string>();
  for (const e of entries) {
    if (e.billable_to_user_id) userIds.add(e.billable_to_user_id);
  }
  const profileNames: Record<string, string> = {};
  if (userIds.size > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", [...userIds]);
    for (const p of profiles ?? []) {
      profileNames[p.id] = p.full_name?.trim() || "Member";
    }
  }

  // Barn members — for new-invoice client picker (barn members not yet seen
  // in billable_to fields)
  const { data: allMembers } = await supabase
    .from("barn_members")
    .select("user_id, barn_id")
    .in("barn_id", barnIds);
  const memberIds = [...new Set((allMembers ?? []).map((m) => m.user_id))];
  if (memberIds.length > 0) {
    const { data: memberProfiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", memberIds);
    for (const p of memberProfiles ?? []) {
      if (!profileNames[p.id]) {
        profileNames[p.id] = p.full_name?.trim() || "Member";
      }
    }
  }

  return (
    <NewInvoiceClient
      barns={barns}
      entries={entries}
      horseNames={horseNames}
      barnNames={barnNames}
      profileNames={profileNames}
    />
  );
}
