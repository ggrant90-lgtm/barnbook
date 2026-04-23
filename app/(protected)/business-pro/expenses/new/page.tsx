import { redirect } from "next/navigation";
import { createServerComponentClient } from "@/lib/supabase-server";
import { NewExpenseClient } from "./NewExpenseClient";
import { EXPENSE_CATEGORIES } from "@/lib/business-pro-constants";

export default async function NewExpensePage() {
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

  if (barns.length === 0) redirect("/business-pro/expenses");
  const barnIds = barns.map((b) => b.id);

  // Derive custom categories so the new-expense dropdown can offer them.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from("barn_expenses")
    .select("category")
    .in("barn_id", barnIds)
    .limit(5000);

  const preset = new Set(EXPENSE_CATEGORIES as readonly string[]);
  const customSet = new Set<string>();
  for (const r of (existing ?? []) as { category: string | null }[]) {
    if (r.category && !preset.has(r.category)) customSet.add(r.category);
  }
  const customCategories = [...customSet].sort((a, b) => a.localeCompare(b));

  return <NewExpenseClient barns={barns} customCategories={customCategories} />;
}
