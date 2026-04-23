import { redirect } from "next/navigation";
import { createServerComponentClient } from "@/lib/supabase-server";
import { InvoiceListClient } from "./InvoiceListClient";

export default async function InvoicingPage() {
  const supabase = await createServerComponentClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const { data: ownedBarns } = await supabase
    .from("barns")
    .select("id, name")
    .eq("owner_id", user.id);
  const barns = (ownedBarns ?? []) as { id: string; name: string }[];
  const barnIds = barns.map((b) => b.id);

  if (barnIds.length === 0) {
    return <InvoiceListClient barns={[]} invoices={[]} profileNames={{}} barnNames={{}} clientNames={{}} />;
  }

  // Fetch all invoices across owned barns
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: invoices } = await (supabase as any)
    .from("invoices")
    .select("*")
    .in("barn_id", barnIds)
    .order("created_at", { ascending: false })
    .limit(500);

  // Compute overdue status on the fly (DB status may still be 'sent')
  const today = new Date().toISOString().slice(0, 10);
  const withComputedStatus = ((invoices ?? []) as Record<string, unknown>[]).map((inv) => {
    const i = inv as { status: string; due_date: string | null };
    if (
      (i.status === "sent" || i.status === "partial") &&
      i.due_date &&
      i.due_date < today
    ) {
      return { ...inv, display_status: "overdue" };
    }
    return { ...inv, display_status: i.status };
  });

  // Look up profile names for billable_to_user_id
  const userIds = new Set<string>();
  for (const inv of withComputedStatus) {
    const i = inv as unknown as { billable_to_user_id: string | null };
    if (i.billable_to_user_id) userIds.add(i.billable_to_user_id);
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

  const barnNames: Record<string, string> = {};
  for (const b of barns) barnNames[b.id] = b.name;

  // Look up client names for invoices that were stamped with client_id
  const clientIds = new Set<string>();
  for (const inv of withComputedStatus) {
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
    <InvoiceListClient
      barns={barns}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      invoices={withComputedStatus as any[]}
      profileNames={profileNames}
      barnNames={barnNames}
      clientNames={clientNames}
    />
  );
}
