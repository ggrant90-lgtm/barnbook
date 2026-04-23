import { redirect } from "next/navigation";
import { createServerComponentClient } from "@/lib/supabase-server";
import { ClientsListClient } from "./ClientsListClient";

export default async function ClientsPage() {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const { data: ownedBarns } = await supabase
    .from("barns")
    .select("id, name")
    .eq("owner_id", user.id);
  const barns = (ownedBarns ?? []) as { id: string; name: string }[];
  const barnIds = barns.map((b) => b.id);

  if (barnIds.length === 0) {
    return (
      <ClientsListClient
        barns={[]}
        clients={[]}
        horseCounts={{}}
        invoiceStats={{}}
      />
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: clients } = await (supabase as any)
    .from("barn_clients")
    .select("*")
    .in("barn_id", barnIds)
    .order("display_name", { ascending: true })
    .limit(5000);

  const clientRows = (clients ?? []) as Array<{
    id: string;
    barn_id: string;
    display_name: string;
    name_key: string;
    email: string | null;
    phone: string | null;
    archived: boolean;
    created_at: string;
  }>;

  // Aggregate: horse count per client (by horses.owner_name name-match)
  const { data: horses } = await supabase
    .from("horses")
    .select("id, barn_id, owner_name")
    .in("barn_id", barnIds)
    .eq("archived", false);

  const horseCounts: Record<string, number> = {};
  for (const c of clientRows) {
    horseCounts[c.id] = 0;
  }
  for (const h of (horses ?? []) as {
    id: string;
    barn_id: string;
    owner_name: string | null;
  }[]) {
    if (!h.owner_name) continue;
    const key = h.owner_name.trim().toLowerCase();
    const match = clientRows.find(
      (c) => c.barn_id === h.barn_id && c.name_key === key,
    );
    if (match) horseCounts[match.id] = (horseCounts[match.id] ?? 0) + 1;
  }

  // Aggregate: open invoices count + outstanding balance per client
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: invoices } = await (supabase as any)
    .from("invoices")
    .select("id, barn_id, client_id, status, subtotal, paid_amount")
    .in("barn_id", barnIds)
    .limit(5000);

  const invoiceStats: Record<
    string,
    { openCount: number; outstanding: number }
  > = {};
  for (const c of clientRows) {
    invoiceStats[c.id] = { openCount: 0, outstanding: 0 };
  }
  for (const inv of (invoices ?? []) as {
    client_id: string | null;
    status: string;
    subtotal: number | null;
    paid_amount: number | null;
  }[]) {
    if (!inv.client_id || !invoiceStats[inv.client_id]) continue;
    if (inv.status === "sent" || inv.status === "partial") {
      invoiceStats[inv.client_id].openCount += 1;
      invoiceStats[inv.client_id].outstanding +=
        (inv.subtotal ?? 0) - (inv.paid_amount ?? 0);
    }
  }

  return (
    <ClientsListClient
      barns={barns}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      clients={clientRows as any[]}
      horseCounts={horseCounts}
      invoiceStats={invoiceStats}
    />
  );
}
