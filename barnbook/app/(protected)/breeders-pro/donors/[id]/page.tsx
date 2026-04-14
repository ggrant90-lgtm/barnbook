import { notFound, redirect } from "next/navigation";
import { createServerComponentClient } from "@/lib/supabase-server";
import {
  computeEmbryoLocation,
  type EmbryoLocation,
} from "@/lib/embryo-location";
import { canUserAccessHorse, canUserEditHorse } from "@/lib/horse-access";
import type { Embryo, Flush, Horse, Pregnancy } from "@/lib/types";
import { DonorProfileClient } from "./DonorProfileClient";

/**
 * Donor mare profile — Breeders Pro view.
 *
 * Scope notes (this page intentionally stays within the "presentation only"
 * rules for the reskin work):
 *
 *   • Auth & access: reuses `canUserAccessHorse` / `canUserEditHorse`, the
 *     same helpers used by `app/(protected)/horses/[id]/page.tsx`.
 *   • Horse fetch: identical `.from("horses").select("*").eq("id", id)`.
 *   • Donor flush fetch: verbatim copy of the donor branch already present
 *     in `horses/[id]/page.tsx` (lines 249–281 at time of writing).
 *   • Donor pregnancy fetch: verbatim copy of same.
 *   • NEW query (authorized by user for Option 1): `embryos` filtered by
 *     `donor_horse_id`. This is a single SELECT against the existing
 *     `embryos` table, filtered by an already-indexed column, with the same
 *     RLS policies that protect every other embryo read in the app. No new
 *     table, no new column, no migration, no server action.
 *   • No data writes, no mutations, no schema changes.
 */
export default async function DonorProfilePage({
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

  // Only donors (or multi-role mares) have this view. Route non-donors to
  // their role-appropriate Breeders Pro profile instead of leaking to the
  // BarnBook horse page.
  if (horse.breeding_role !== "donor" && horse.breeding_role !== "multiple") {
    if (horse.breeding_role === "stallion") {
      redirect(`/breeders-pro/stallions/${id}`);
    }
    if (horse.breeding_role === "recipient") {
      redirect(`/breeders-pro/surrogates/${id}`);
    }
    redirect("/breeders-pro");
  }

  const canEdit = await canUserEditHorse(supabase, user.id, horse.barn_id);

  // ----- Donor flushes (verbatim from horses/[id]/page.tsx donor branch) -----
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: flushRaw } = await (supabase as any)
    .from("flushes")
    .select("*")
    .eq("donor_horse_id", id)
    .order("flush_date", { ascending: false });
  const flushes = (flushRaw ?? []) as Flush[];

  // ----- Donor pregnancies (verbatim from horses/[id]/page.tsx donor branch) -----
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pregRaw } = await (supabase as any)
    .from("pregnancies")
    .select("*")
    .eq("donor_horse_id", id)
    .order("transfer_date", { ascending: false });
  const pregnancies = (pregRaw ?? []) as Pregnancy[];

  // ----- NEW: embryos for this donor (authorized per Option 1) -----
  // Same table + same RLS as `/breeders-pro` embryo bank, scoped to this donor.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: embryosRaw } = await (supabase as any)
    .from("embryos")
    .select("*")
    .eq("donor_horse_id", id)
    .order("created_at", { ascending: false });
  const embryos = (embryosRaw ?? []) as Embryo[];

  // ----- Foalings for all pregnancies of this donor's embryos -----
  // Needed to compute "Current Location" for embryos whose status is
  // `became_foal` — we want to link to the resulting foal profile.
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

  // Index pregnancies by embryo_id for O(1) lookup during location compute
  const pregByEmbryoId = new Map<string, Pregnancy>();
  for (const p of pregnancies) {
    if (p.embryo_id) pregByEmbryoId.set(p.embryo_id, p);
  }

  // ----- Horse-name lookup for stallions / surrogates / foals referenced -----
  const horseIds = new Set<string>();
  for (const f of flushes) {
    if (f.stallion_horse_id) horseIds.add(f.stallion_horse_id);
  }
  for (const p of pregnancies) {
    if (p.stallion_horse_id) horseIds.add(p.stallion_horse_id);
    if (p.surrogate_horse_id) horseIds.add(p.surrogate_horse_id);
  }
  for (const e of embryos) {
    if (e.stallion_horse_id) horseIds.add(e.stallion_horse_id);
  }
  for (const f of foalingsByPregId.values()) {
    if (f.foal_horse_id) horseIds.add(f.foal_horse_id);
  }
  // Lineage lookup: parent horse names (if linked by id)
  if (horse.sire_horse_id) horseIds.add(horse.sire_horse_id);
  if (horse.dam_horse_id) horseIds.add(horse.dam_horse_id);

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

  // Pre-compute a { embryoId → location } map so the client component
  // just renders values. Keeps all the horse-name lookups on the server.
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

  // ----- OPU sessions for this donor -----
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: opuRaw } = await (supabase as any)
    .from("opu_sessions")
    .select("*")
    .eq("donor_horse_id", id)
    .order("opu_date", { ascending: false });

  const opuSessions = (opuRaw ?? []) as Array<{
    id: string;
    opu_date: string;
    veterinarian: string | null;
    facility: string | null;
    oocytes_recovered: number;
    oocytes_mature: number | null;
    oocytes_immature: number | null;
    cost: number | null;
    notes: string | null;
    created_at: string;
  }>;

  // Fetch oocyte + batch summaries for each OPU session
  const opuIds = opuSessions.map((s) => s.id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: oocyteSummaryRaw } = opuIds.length > 0
    ? await (supabase as any)
        .from("oocytes")
        .select("opu_session_id, status, embryo_id")
        .in("opu_session_id", opuIds)
    : { data: [] };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: batchSummaryRaw } = opuIds.length > 0
    ? await (supabase as any)
        .from("icsi_batches")
        .select("id, opu_session_id, stallion_horse_id, status")
        .in("opu_session_id", opuIds)
    : { data: [] };

  // Build per-session summaries
  const opuSummaries: Record<
    string,
    {
      totalOocytes: number;
      developed: number;
      failed: number;
      pending: number;
      batches: number;
      embryosCreated: number;
      stallionNames: string[];
    }
  > = {};

  for (const s of opuSessions) {
    const oocytes = ((oocyteSummaryRaw ?? []) as Array<{
      opu_session_id: string;
      status: string;
      embryo_id: string | null;
    }>).filter((o) => o.opu_session_id === s.id);

    const batches = ((batchSummaryRaw ?? []) as Array<{
      id: string;
      opu_session_id: string;
      stallion_horse_id: string;
      status: string;
    }>).filter((b) => b.opu_session_id === s.id);

    // Add stallion IDs to horse name lookup
    for (const b of batches) {
      if (b.stallion_horse_id) horseIds.add(b.stallion_horse_id);
    }

    opuSummaries[s.id] = {
      totalOocytes: oocytes.length,
      developed: oocytes.filter((o) => o.status === "developed").length,
      failed: oocytes.filter((o) => o.status === "failed").length,
      pending: oocytes.filter(
        (o) => o.status !== "developed" && o.status !== "failed",
      ).length,
      batches: batches.length,
      embryosCreated: oocytes.filter((o) => o.embryo_id != null).length,
      stallionNames: batches.map((b) => b.stallion_horse_id),
    };
  }

  // Re-fetch horse names since we may have added stallion IDs from batches
  if (horseIds.size > 0) {
    const { data: horseRows2 } = await supabase
      .from("horses")
      .select("id, name")
      .in("id", [...horseIds]);
    for (const h of horseRows2 ?? []) {
      horseNames[h.id] = h.name;
    }
  }

  return (
    <DonorProfileClient
      horse={horse}
      flushes={flushes}
      pregnancies={pregnancies}
      embryos={embryos}
      embryoLocations={embryoLocations}
      opuSessions={opuSessions}
      opuSummaries={opuSummaries}
      horseNames={horseNames}
      canEdit={canEdit}
    />
  );
}
