import { canUserEditHorse } from "@/lib/horse-access";
import { createServerComponentClient } from "@/lib/supabase-server";
import type { Pregnancy, Foaling } from "@/lib/types";
import { redirect, notFound } from "next/navigation";
import { PregnancyDetailClient } from "./PregnancyDetailClient";

export default async function PregnancyDetailPage({
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
  const { data: pregnancyRaw, error } = await (supabase as any)
    .from("pregnancies")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !pregnancyRaw) notFound();
  const pregnancy = pregnancyRaw as Pregnancy;

  const canEdit = await canUserEditHorse(supabase, user.id, pregnancy.barn_id);

  // Fetch horse names
  const horseIds = new Set<string>();
  if (pregnancy.donor_horse_id) horseIds.add(pregnancy.donor_horse_id);
  if (pregnancy.stallion_horse_id) horseIds.add(pregnancy.stallion_horse_id);
  if (pregnancy.surrogate_horse_id) horseIds.add(pregnancy.surrogate_horse_id);

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

  // Fetch foaling if exists
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: foalingRaw } = await (supabase as any)
    .from("foalings")
    .select("*")
    .eq("pregnancy_id", id)
    .maybeSingle();

  const foaling = foalingRaw ? (foalingRaw as Foaling) : null;

  return (
    <PregnancyDetailClient
      pregnancy={pregnancy}
      horseNames={horseNames}
      canEdit={canEdit}
      foaling={foaling}
    />
  );
}
