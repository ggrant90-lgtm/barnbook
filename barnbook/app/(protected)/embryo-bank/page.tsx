import { getActiveBarnContext } from "@/lib/barn-session";
import { canUserEditHorse } from "@/lib/horse-access";
import { createServerComponentClient } from "@/lib/supabase-server";
import type { Embryo } from "@/lib/types";
import { redirect } from "next/navigation";
import { EmbryoBankClient } from "./EmbryoBankClient";

export default async function EmbryoBankPage() {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const ctx = await getActiveBarnContext(supabase, user.id);
  if (!ctx) redirect("/dashboard");

  const canEdit = await canUserEditHorse(supabase, user.id, ctx.barn.id);

  // Fetch all embryos for this barn
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: embryosRaw, error } = await (supabase as any)
    .from("embryos")
    .select("*")
    .eq("barn_id", ctx.barn.id)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="px-4 py-10 text-barn-red">
        Could not load embryos: {error.message}
      </div>
    );
  }

  const embryos = (embryosRaw ?? []) as Embryo[];

  // Fetch horse names for donor and stallion lookups
  const horseIds = new Set<string>();
  for (const e of embryos) {
    horseIds.add(e.donor_horse_id);
    if (e.stallion_horse_id) horseIds.add(e.stallion_horse_id);
  }

  const horseNames: Record<string, string> = {};
  if (horseIds.size > 0) {
    const { data: horses } = await supabase
      .from("horses")
      .select("id, name")
      .in("id", [...horseIds]);
    for (const h of horses ?? []) {
      horseNames[h.id] = h.name;
    }
  }

  return (
    <EmbryoBankClient
      embryos={embryos}
      horseNames={horseNames}
      canEdit={canEdit}
    />
  );
}
