import { redirect } from "next/navigation";
import { createServerComponentClient } from "@/lib/supabase-server";
import { ExpensesListClient } from "./ExpensesListClient";
import { EXPENSE_CATEGORIES } from "@/lib/business-pro-constants";

export default async function ExpensesPage() {
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
      <ExpensesListClient
        barns={[]}
        expenses={[]}
        barnNames={{}}
        customCategories={[]}
      />
    );
  }

  // Pull the last 12 months so the summary + filters have meaningful data.
  const sinceISO = new Date(
    new Date().setMonth(new Date().getMonth() - 12),
  ).toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: expenses } = await (supabase as any)
    .from("barn_expenses")
    .select("*")
    .in("barn_id", barnIds)
    .gte("performed_at", sinceISO)
    .order("performed_at", { ascending: false })
    .limit(5000);

  const rows = (expenses ?? []) as Record<string, unknown>[];

  const barnNames: Record<string, string> = {};
  for (const b of barns) barnNames[b.id] = b.name;

  // Derive distinct custom categories (non-preset) so future forms can offer
  // them as dropdown options.
  const preset = new Set(EXPENSE_CATEGORIES as readonly string[]);
  const customSet = new Set<string>();
  for (const r of rows) {
    const cat = r.category as string | null;
    if (cat && !preset.has(cat)) customSet.add(cat);
  }
  const customCategories = [...customSet].sort((a, b) => a.localeCompare(b));

  return (
    <ExpensesListClient
      barns={barns}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expenses={rows as any[]}
      barnNames={barnNames}
      customCategories={customCategories}
    />
  );
}
