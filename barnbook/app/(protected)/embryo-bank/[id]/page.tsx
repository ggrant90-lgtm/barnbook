import { canUserEditHorse } from "@/lib/horse-access";
import { createServerComponentClient } from "@/lib/supabase-server";
import type { Embryo } from "@/lib/types";
import { redirect, notFound } from "next/navigation";
import { EmbryoDetailClient } from "./EmbryoDetailClient";

export default async function EmbryoDetailPage({
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
  const { data: embryoRaw, error } = await (supabase as any)
    .from("embryos")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !embryoRaw) notFound();
  const embryo = embryoRaw as Embryo;

  const canEdit = await canUserEditHorse(supabase, user.id, embryo.barn_id);

  // Fetch horse names
  const horseIds = [embryo.donor_horse_id];
  if (embryo.stallion_horse_id) horseIds.push(embryo.stallion_horse_id);

  const horseNames: Record<string, string> = {};
  const { data: horses } = await supabase
    .from("horses")
    .select("id, name")
    .in("id", horseIds);
  for (const h of horses ?? []) {
    horseNames[h.id] = h.name;
  }

  // Fetch surrogate mares in barn for transfer
  const { data: surrogates } = await supabase
    .from("horses")
    .select("id, name")
    .eq("barn_id", embryo.barn_id)
    .eq("archived", false)
    .in("breeding_role", ["recipient", "multiple"]);

  return (
    <EmbryoDetailClient
      embryo={embryo}
      horseNames={horseNames}
      canEdit={canEdit}
      surrogates={(surrogates ?? []) as { id: string; name: string }[]}
    />
  );
}
