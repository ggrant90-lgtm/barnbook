import { redirect, notFound } from "next/navigation";
import { createServerComponentClient } from "@/lib/supabase-server";
import { ExpenseDetailClient } from "./ExpenseDetailClient";
import { EXPENSE_CATEGORIES } from "@/lib/business-pro-constants";

// Next.js 16: params is a Promise — must await.
export default async function ExpenseDetailPage({
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
  const { data: expense } = await (supabase as any)
    .from("barn_expenses")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!expense) notFound();

  // Verify barn ownership
  const { data: barn } = await supabase
    .from("barns")
    .select("id, name, owner_id")
    .eq("id", expense.barn_id)
    .maybeSingle();
  if (!barn || barn.owner_id !== user.id) {
    redirect("/business-pro/expenses");
  }

  // Owned barns for the barn selector in edit form
  const { data: ownedBarns } = await supabase
    .from("barns")
    .select("id, name")
    .eq("owner_id", user.id);
  const barns = (ownedBarns ?? []) as { id: string; name: string }[];
  const barnIds = barns.map((b) => b.id);

  // Derive custom categories from the user's history
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

  return (
    <ExpenseDetailClient
      expense={expense}
      barns={barns}
      customCategories={customCategories}
    />
  );
}
