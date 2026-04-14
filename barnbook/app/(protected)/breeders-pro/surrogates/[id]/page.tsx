import { notFound, redirect } from "next/navigation";
import { createServerComponentClient } from "@/lib/supabase-server";
import { canUserAccessHorse, canUserEditHorse } from "@/lib/horse-access";
import type {
  Embryo,
  Foaling,
  Horse,
  HorseCurrentLocation,
  HorseLocationAssignment,
  Location,
  Pregnancy,
} from "@/lib/types";
import { SurrogateProfileClient } from "./SurrogateProfileClient";

/**
 * Surrogate (recipient mare) profile — Breeders Pro view.
 *
 * Presentation-layer route. All reads use the same helpers and the same
 * tables as the donor and stallion routes — no migrations, no mutations.
 */
export default async function SurrogateProfilePage({
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

  // Only recipient mares or multi-role get this view.
  if (
    horse.breeding_role !== "recipient" &&
    horse.breeding_role !== "multiple"
  ) {
    redirect("/breeders-pro");
  }

  const canEdit = await canUserEditHorse(supabase, user.id, horse.barn_id);

  // ----- Pregnancies this surrogate has carried -----
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pregRaw } = await (supabase as any)
    .from("pregnancies")
    .select("*")
    .eq("surrogate_horse_id", id)
    .order("transfer_date", { ascending: false });
  const pregnancies = (pregRaw ?? []) as Pregnancy[];

  // ----- Transferred embryos referenced by those pregnancies -----
  const embryoIds = [...new Set(pregnancies.map((p) => p.embryo_id))];
  let embryos: Embryo[] = [];
  if (embryoIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: embryosRaw } = await (supabase as any)
      .from("embryos")
      .select("*")
      .in("id", embryoIds);
    embryos = (embryosRaw ?? []) as Embryo[];
  }

  // ----- Foalings by this surrogate -----
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: foalingRaw } = await (supabase as any)
    .from("foalings")
    .select("*")
    .eq("surrogate_horse_id", id)
    .order("foaling_date", { ascending: false });
  const foalings = (foalingRaw ?? []) as Foaling[];

  // ----- Horse-name lookup for donors and stallions referenced above -----
  const horseIds = new Set<string>();
  for (const p of pregnancies) {
    if (p.donor_horse_id) horseIds.add(p.donor_horse_id);
    if (p.stallion_horse_id) horseIds.add(p.stallion_horse_id);
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

  // ----- Current location (from the horse_current_location view) -----
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: currentLocationRaw } = await (supabase as any)
    .from("horse_current_location")
    .select("*")
    .eq("horse_id", id)
    .maybeSingle();
  const currentLocation = (currentLocationRaw ?? null) as
    | HorseCurrentLocation
    | null;

  // ----- Location history (all assignments, most recent first) -----
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: historyRaw } = await (supabase as any)
    .from("horse_location_assignments")
    .select("*")
    .eq("horse_id", id)
    .order("started_at", { ascending: false });
  const locationHistory = (historyRaw ?? []) as HorseLocationAssignment[];

  // ----- Facilities available for the Update Location picker -----
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: facilitiesRaw } = await (supabase as any)
    .from("locations")
    .select("*")
    .eq("barn_id", horse.barn_id)
    .eq("archived", false)
    .order("facility_name", { ascending: true });
  const facilities = (facilitiesRaw ?? []) as Location[];

  // ----- Lookup for history display (location id → facility name) -----
  const locationNames: Record<string, string> = {};
  for (const f of facilities) {
    locationNames[f.id] = f.facility_name;
  }
  // Also fetch any archived facilities referenced in history so the
  // timeline can still show the name even if the facility was retired.
  const historyLocationIds = new Set(
    locationHistory.map((h) => h.location_id),
  );
  const missingIds = [...historyLocationIds].filter(
    (id) => !locationNames[id],
  );
  if (missingIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: archivedRaw } = await (supabase as any)
      .from("locations")
      .select("id, facility_name")
      .in("id", missingIds);
    for (const row of (archivedRaw ?? []) as {
      id: string;
      facility_name: string;
    }[]) {
      locationNames[row.id] = row.facility_name;
    }
  }

  return (
    <SurrogateProfileClient
      horse={horse}
      pregnancies={pregnancies}
      embryos={embryos}
      foalings={foalings}
      horseNames={horseNames}
      canEdit={canEdit}
      currentLocation={currentLocation}
      locationHistory={locationHistory}
      facilities={facilities}
      locationNames={locationNames}
    />
  );
}
