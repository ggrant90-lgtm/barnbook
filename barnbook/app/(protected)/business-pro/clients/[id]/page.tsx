import { redirect, notFound } from "next/navigation";
import { createServerComponentClient } from "@/lib/supabase-server";
import { ClientProfileClient } from "./ClientProfileClient";

export default async function ClientProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: client } = await (supabase as any)
    .from("barn_clients")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!client) notFound();

  // Verify barn ownership
  const { data: barn } = await supabase
    .from("barns")
    .select("id, name, owner_id")
    .eq("id", client.barn_id)
    .maybeSingle();
  if (!barn || barn.owner_id !== user.id) {
    redirect("/business-pro/clients");
  }

  // Parallel fetches for the profile tabs
  const [
    horsesRes,
    invoicesRes,
    documentsRes,
    activityRes,
    healthRes,
  ] = await Promise.all([
    // Horses owned by this client (name-match)
    supabase
      .from("horses")
      .select("id, name, status, archived, barn_id, owner_name")
      .eq("barn_id", client.barn_id)
      .eq("archived", false)
      .limit(500),
    // Invoices: either client_id match OR legacy name/user match
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("invoices")
      .select(
        "id, invoice_number, issue_date, due_date, status, subtotal, paid_amount, client_id, billable_to_user_id, billable_to_name",
      )
      .eq("barn_id", client.barn_id)
      .order("issue_date", { ascending: false })
      .limit(500),
    // Documents
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("barn_client_documents")
      .select("*")
      .eq("client_id", id)
      .order("created_at", { ascending: false })
      .limit(500),
    // Last activity entries
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("activity_log")
      .select(
        "id, horse_id, activity_type, notes, performed_at, created_at, total_cost, cost_type, payment_status, client_id, billable_to_user_id, billable_to_name",
      )
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(200),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("health_records")
      .select(
        "id, horse_id, record_type, notes, performed_at, created_at, total_cost, cost_type, payment_status, client_id, billable_to_user_id, billable_to_name",
      )
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const allHorses = (horsesRes.data ?? []) as {
    id: string;
    name: string;
    status: string | null;
    barn_id: string;
    owner_name: string | null;
  }[];
  const clientHorses = allHorses.filter(
    (h) =>
      h.owner_name && h.owner_name.trim().toLowerCase() === client.name_key,
  );
  const horseIds = new Set(allHorses.map((h) => h.id));
  const horseNamesById: Record<string, string> = {};
  for (const h of allHorses) horseNamesById[h.id] = h.name;

  // Filter invoices: prefer client_id, fall back to legacy match
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const invoices = ((invoicesRes.data ?? []) as any[]).filter((inv) => {
    if (inv.client_id === id) return true;
    if (inv.client_id) return false; // Linked to another client
    if (client.user_id && inv.billable_to_user_id === client.user_id)
      return true;
    if (
      !inv.billable_to_user_id &&
      inv.billable_to_name &&
      inv.billable_to_name.trim().toLowerCase() === client.name_key
    )
      return true;
    return false;
  });

  // Same filter for activity + health
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const matchesClient = (e: any) => {
    if (e.client_id === id) return true;
    if (e.client_id) return false;
    if (client.user_id && e.billable_to_user_id === client.user_id) return true;
    if (
      !e.billable_to_user_id &&
      e.billable_to_name &&
      e.billable_to_name.trim().toLowerCase() === client.name_key
    )
      return true;
    return false;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activityEntries = ((activityRes.data ?? []) as any[])
    .filter((e) => horseIds.has(e.horse_id) && matchesClient(e))
    .slice(0, 50);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const healthEntries = ((healthRes.data ?? []) as any[])
    .filter((e) => horseIds.has(e.horse_id) && matchesClient(e))
    .slice(0, 50);

  const documents = (documentsRes.data ?? []) as Array<{
    id: string;
    doc_type: string;
    custom_label: string | null;
    title: string;
    file_name: string;
    file_size_bytes: number;
    mime_type: string;
    effective_date: string | null;
    expiry_date: string | null;
    created_at: string;
  }>;

  // Summary: total billed + total paid + outstanding
  let totalBilled = 0;
  let totalPaid = 0;
  let totalOutstanding = 0;
  for (const inv of invoices) {
    const i = inv as {
      status: string;
      subtotal: number | null;
      paid_amount: number | null;
    };
    if (i.status === "void" || i.status === "draft") continue;
    totalBilled += i.subtotal ?? 0;
    totalPaid += i.paid_amount ?? 0;
    if (i.status === "sent" || i.status === "partial") {
      totalOutstanding += (i.subtotal ?? 0) - (i.paid_amount ?? 0);
    }
  }

  return (
    <ClientProfileClient
      client={client}
      barnName={barn.name}
      horses={clientHorses}
      horseNames={horseNamesById}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      invoices={invoices as any[]}
      activityEntries={activityEntries.map((e) => ({
        ...e,
        source: "activity" as const,
      }))}
      healthEntries={healthEntries.map((e) => ({
        ...e,
        source: "health" as const,
      }))}
      documents={documents}
      summary={{ totalBilled, totalPaid, totalOutstanding }}
    />
  );
}
