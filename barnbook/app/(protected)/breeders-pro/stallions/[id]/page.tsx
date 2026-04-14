import { notFound, redirect } from "next/navigation";
import { createServerComponentClient } from "@/lib/supabase-server";
import {
  computeEmbryoLocation,
  type EmbryoLocation,
} from "@/lib/embryo-location";
import { canUserAccessHorse, canUserEditHorse } from "@/lib/horse-access";
import type { Embryo, Flush, Horse, Pregnancy } from "@/lib/types";
import { StallionProfileClient } from "./StallionProfileClient";

/**
 * Stallion profile — Breeders Pro view.
 *
 * Presentation-layer route. Reuses the same auth / access helpers and
 * the same read-only SELECTs against the existing tables as the donor
 * and embryo routes. No new tables, no new columns, no mutations.
 */
export default async function StallionProfilePage({
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

  const ok = await canUserAccessHorse(supabase, user.id, id);
  if (!ok) redirect("/breeders-pro");

  const { data: horseRaw, error: horseErr } = await supabase
    .from("horses")
    .select("*")
    .eq("id", id)
    .single();
  if (horseErr || !horseRaw) notFound();

  const horse = horseRaw as Horse;

  // Only barn stallions (or multi-role) get this view. Anything else routes
  // back to the embryo bank rather than leaking to the BarnBook horse page.
  if (
    horse.breeding_role !== "stallion" &&
    horse.breeding_role !== "multiple"
  ) {
    redirect("/breeders-pro");
  }

  const canEdit = await canUserEditHorse(supabase, user.id, horse.barn_id);

  // ----- Flushes where this horse was the sire -----
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: flushRaw } = await (supabase as any)
    .from("flushes")
    .select("*")
    .eq("stallion_horse_id", id)
    .order("flush_date", { ascending: false });
  const flushes = (flushRaw ?? []) as Flush[];

  // ----- Embryos sired by this horse (for per-donor rollups) -----
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: embryosRaw } = await (supabase as any)
    .from("embryos")
    .select("*")
    .eq("stallion_horse_id", id)
    .order("created_at", { ascending: false });
  const embryos = (embryosRaw ?? []) as Embryo[];

  // ----- Pregnancies sired by this horse -----
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pregRaw } = await (supabase as any)
    .from("pregnancies")
    .select("*")
    .eq("stallion_horse_id", id)
    .order("transfer_date", { ascending: false });
  const pregnancies = (pregRaw ?? []) as Pregnancy[];

  // ----- Foalings for those pregnancies (for location compute) -----
  const pregIds = pregnancies.map((p) => p.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: foalingsRaw } = pregIds.length > 0
    ? await (supabase as any)
        .from("foalings")
        .select("id, pregnancy_id, foal_horse_id, foaling_date")
        .in("pregnancy_id", pregIds)
    : { data: [] };
  const foalingsByPregId = new Map<
    string,
    { id: string; foal_horse_id: string | null; foaling_date: string | null }
  >();
  for (const f of (foalingsRaw ?? []) as Array<{
    id: string;
    pregnancy_id: string;
    foal_horse_id: string | null;
    foaling_date: string | null;
  }>) {
    foalingsByPregId.set(f.pregnancy_id, {
      id: f.id,
      foal_horse_id: f.foal_horse_id,
      foaling_date: f.foaling_date,
    });
  }

  const pregByEmbryoId = new Map<string, Pregnancy>();
  for (const p of pregnancies) {
    if (p.embryo_id) pregByEmbryoId.set(p.embryo_id, p);
  }

  // ----- Horse-name lookup for donor mares / surrogates / foals -----
  const horseIds = new Set<string>();
  for (const f of flushes) if (f.donor_horse_id) horseIds.add(f.donor_horse_id);
  for (const e of embryos) if (e.donor_horse_id) horseIds.add(e.donor_horse_id);
  for (const p of pregnancies) {
    if (p.donor_horse_id) horseIds.add(p.donor_horse_id);
    if (p.surrogate_horse_id) horseIds.add(p.surrogate_horse_id);
  }
  for (const f of foalingsByPregId.values()) {
    if (f.foal_horse_id) horseIds.add(f.foal_horse_id);
  }

  const horseNames: Record<string, string> = {};
  if (horseIds.size > 0) {
    const { data: horseRows } = await supabase
      .from("horses")
      .select("id, name")
      .in("id", [...horseIds]);
    for (const h of horseRows ?? []) {
      horseNames[h.id] = h.name;
    }
  }

  // Pre-compute embryo locations server-side, same shape as donor profile.
  const embryoLocations: Record<string, EmbryoLocation> = {};
  for (const e of embryos) {
    const preg = pregByEmbryoId.get(e.id) ?? null;
    const foal = preg ? (foalingsByPregId.get(preg.id) ?? null) : null;
    embryoLocations[e.id] = computeEmbryoLocation({
      embryo: e as unknown as Parameters<
        typeof computeEmbryoLocation
      >[0]["embryo"],
      pregnancy: preg
        ? {
            id: preg.id,
            surrogate_horse_id: preg.surrogate_horse_id ?? null,
            transfer_date: preg.transfer_date ?? null,
            expected_foaling_date: preg.expected_foaling_date ?? null,
            status: preg.status,
          }
        : null,
      foaling: foal,
      horseNames,
    });
  }

  return (
    <StallionProfileClient
      horse={horse}
      flushes={flushes}
      embryos={embryos}
      pregnancies={pregnancies}
      embryoLocations={embryoLocations}
      horseNames={horseNames}
      canEdit={canEdit}
    />
  );
}
