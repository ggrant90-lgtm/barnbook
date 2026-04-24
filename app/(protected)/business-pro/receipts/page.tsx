import { redirect } from "next/navigation";
import { createServerComponentClient } from "@/lib/supabase-server";
import { ReceiptsBinClient } from "./ReceiptsBinClient";

/**
 * Business Pro — Receipts bin. One card per scanned receipt, grouped
 * by `receipt_group_id` so split receipts (one scan → multiple
 * barn_expenses rows) collapse back into a single card.
 *
 * BP-gated: the surrounding /business-pro/* layout already enforces
 * `ModuleGate`, and the signed-URL action double-checks BP on every
 * fetch as defense in depth.
 */
export default async function ReceiptsBinPage() {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  // Owned barns — the existing barn_expenses RLS already restricts
  // inserts to owners, so the receipts bin mirrors that scope.
  const { data: ownedBarns } = await supabase
    .from("barns")
    .select("id, name")
    .eq("owner_id", user.id);
  const barns = (ownedBarns ?? []) as { id: string; name: string }[];
  const barnIds = barns.map((b) => b.id);

  if (barnIds.length === 0) {
    return <ReceiptsBinClient receipts={[]} barnNames={{}} />;
  }

  // Pull every row with a receipt attached. Select everything we need
  // for the card + modal preview in one round trip.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rows } = await (supabase as any)
    .from("barn_expenses")
    .select(
      "id, barn_id, performed_at, category, vendor_name, description, total_cost, receipt_file_path, receipt_file_name, receipt_mime_type, receipt_group_id, created_at",
    )
    .in("barn_id", barnIds)
    .not("receipt_file_path", "is", null)
    .order("performed_at", { ascending: false })
    .limit(2000);

  type Row = {
    id: string;
    barn_id: string;
    performed_at: string;
    category: string;
    vendor_name: string | null;
    description: string | null;
    total_cost: number;
    receipt_file_path: string;
    receipt_file_name: string | null;
    receipt_mime_type: string | null;
    receipt_group_id: string | null;
    created_at: string;
  };
  const all = (rows ?? []) as Row[];

  // Group by receipt_group_id (a single scan event). Null groups
  // become singletons keyed by id so they still render as one card.
  const byGroup = new Map<
    string,
    {
      groupKey: string;
      primaryId: string;
      barn_id: string;
      performed_at: string;
      vendor_name: string | null;
      total_cost: number;
      categories: string[];
      rowCount: number;
      receipt_file_name: string | null;
    }
  >();

  for (const r of all) {
    const key = r.receipt_group_id ?? `single:${r.id}`;
    const existing = byGroup.get(key);
    if (existing) {
      existing.total_cost += r.total_cost ?? 0;
      if (!existing.categories.includes(r.category)) {
        existing.categories.push(r.category);
      }
      existing.rowCount += 1;
      // Newer performed_at wins the card's date (shouldn't differ
      // across split rows from the same receipt, but defensive).
      if (r.performed_at > existing.performed_at) {
        existing.performed_at = r.performed_at;
      }
    } else {
      byGroup.set(key, {
        groupKey: key,
        primaryId: r.id,
        barn_id: r.barn_id,
        performed_at: r.performed_at,
        vendor_name: r.vendor_name,
        total_cost: r.total_cost ?? 0,
        categories: [r.category],
        rowCount: 1,
        receipt_file_name: r.receipt_file_name,
      });
    }
  }

  const receipts = [...byGroup.values()].sort((a, b) =>
    b.performed_at.localeCompare(a.performed_at),
  );

  const barnNames: Record<string, string> = {};
  for (const b of barns) barnNames[b.id] = b.name;

  return <ReceiptsBinClient receipts={receipts} barnNames={barnNames} />;
}
