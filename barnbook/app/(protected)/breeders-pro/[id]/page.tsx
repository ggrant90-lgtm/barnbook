import { computeEmbryoLocation } from "@/lib/embryo-location";
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

  // ---- Fetch the pregnancy + foaling for this embryo (if any) ----
  // Used by the Current Location strip. An embryo has at most one
  // pregnancy today (no re-transfer flow), so `.maybeSingle()` is safe.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pregnancyRaw } = await (supabase as any)
    .from("pregnancies")
    .select(
      "id, surrogate_horse_id, transfer_date, expected_foaling_date, status",
    )
    .eq("embryo_id", embryo.id)
    .maybeSingle();
  const pregnancy = pregnancyRaw as {
    id: string;
    surrogate_horse_id: string | null;
    transfer_date: string | null;
    expected_foaling_date: string | null;
    status: string;
  } | null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: foalingRaw } = pregnancy
    ? await (supabase as any)
        .from("foalings")
        .select("id, foal_horse_id, foaling_date")
        .eq("pregnancy_id", pregnancy.id)
        .maybeSingle()
    : { data: null };
  const foaling = foalingRaw as {
    id: string;
    foal_horse_id: string | null;
    foaling_date: string | null;
  } | null;

  // ---- Fetch horse names (donor, sire, surrogate, foal) ----
  // Collect every horse id this page might render and fetch them in
  // one IN query.
  const horseIds: string[] = [embryo.donor_horse_id];
  if (embryo.stallion_horse_id) horseIds.push(embryo.stallion_horse_id);
  if (pregnancy?.surrogate_horse_id)
    horseIds.push(pregnancy.surrogate_horse_id);
  if (foaling?.foal_horse_id) horseIds.push(foaling.foal_horse_id);

  const horseNames: Record<string, string> = {};
  if (horseIds.length > 0) {
    const { data: horses } = await supabase
      .from("horses")
      .select("id, name")
      .in("id", horseIds);
    for (const h of horses ?? []) {
      horseNames[h.id] = h.name;
    }
  }

  // Pre-compute the embryo's current location on the server so the
  // client component just renders values — no client-side horse lookups.
  const location = computeEmbryoLocation({
    embryo,
    pregnancy,
    foaling,
    horseNames,
  });

  // Fetch surrogate mares in barn for the Transfer picker.
  // Hide mares that already have an active pregnancy — they can't be used
  // as recipients for another embryo until their current cycle closes.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: activePregRows } = await (supabase as any)
    .from("pregnancies")
    .select("surrogate_horse_id")
    .eq("barn_id", embryo.barn_id)
    .in("status", ["pending_check", "confirmed"]);
  const busyIds = new Set<string>(
    (activePregRows ?? []).map(
      (r: { surrogate_horse_id: string }) => r.surrogate_horse_id,
    ),
  );

  const { data: allSurrogates } = await supabase
    .from("horses")
    .select("id, name, registration_number")
    .eq("barn_id", embryo.barn_id)
    .eq("archived", false)
    .in("breeding_role", ["recipient", "multiple"])
    .order("name", { ascending: true });

  const surrogates = (allSurrogates ?? []).filter(
    (h: { id: string }) => !busyIds.has(h.id),
  );

  return (
    <EmbryoDetailClient
      embryo={embryo}
      horseNames={horseNames}
      canEdit={canEdit}
      location={location}
      surrogates={
        surrogates as {
          id: string;
          name: string;
          registration_number: string | null;
        }[]
      }
    />
  );
}
