import { redirect } from "next/navigation";
import { createServerComponentClient } from "@/lib/supabase-server";
import { getActiveBarnContext } from "@/lib/barn-session";
import { getHorseDisplayName } from "@/lib/horse-name";
import { getOnboardingState } from "@/lib/onboarding-query";
import { BreedersProOnboardingLauncher } from "@/components/onboarding/BreedersProOnboardingLauncher";
import { OverviewClient } from "./OverviewClient";
import type { Pregnancy } from "@/lib/types";

export default async function OverviewPage() {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const ctx = await getActiveBarnContext(supabase, user.id);
  const barnId = ctx?.barn?.id;
  if (!barnId) redirect("/breeders-pro");

  // ── Parallel data fetches ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const currentYear = new Date().getFullYear();
  const yearStart = `${currentYear}-01-01`;

  const [
    { data: pregnancies },
    { data: embryos },
    { data: donors },
    { data: stallions },
    { data: surrogates },
    { data: foalingsThisYear },
    { data: recentFoalings },
    { data: maresInHeat },
    { data: recentBreedLogs },
  ] = await Promise.all([
    // Active pregnancies
    db
      .from("pregnancies")
      .select("*")
      .eq("barn_id", barnId)
      .in("status", ["pending_check", "confirmed"])
      .order("expected_foaling_date", { ascending: true }),
    // Embryos in bank
    db
      .from("embryos")
      .select("id, status")
      .eq("barn_id", barnId)
      .in("status", ["in_bank_fresh", "in_bank_frozen"]),
    // Donor count
    supabase
      .from("horses")
      .select("id", { count: "exact", head: true })
      .eq("barn_id", barnId)
      .eq("archived", false)
      .in("breeding_role", ["donor", "multiple"]),
    // Stallion count
    supabase
      .from("horses")
      .select("id", { count: "exact", head: true })
      .eq("barn_id", barnId)
      .eq("archived", false)
      .in("breeding_role", ["stallion", "multiple"]),
    // Surrogate count
    supabase
      .from("horses")
      .select("id", { count: "exact", head: true })
      .eq("barn_id", barnId)
      .eq("archived", false)
      .in("breeding_role", ["recipient", "multiple"]),
    // Foals this season
    db
      .from("foalings")
      .select("id", { count: "exact", head: true })
      .eq("barn_id", barnId)
      .gte("foaling_date", yearStart),
    // Recent foalings (last 5)
    db
      .from("foalings")
      .select("id, foaling_date, foal_sex, foaling_type, foal_horse_id, surrogate_horse_id")
      .eq("barn_id", barnId)
      .order("foaling_date", { ascending: false })
      .limit(5),
    // Mares in heat
    supabase
      .from("horses")
      .select("id, name, barn_name, primary_name_pref")
      .eq("barn_id", barnId)
      .eq("archived", false)
      .eq("reproductive_status", "in_cycle"),
    // Recent breeding activity (breed_data logs)
    supabase
      .from("activity_log")
      .select("id, horse_id, activity_type, notes, details, performed_at, created_at")
      .eq("activity_type", "breed_data")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  // ── Horse name lookups ──
  const horseIds = new Set<string>();
  for (const p of (pregnancies ?? []) as Pregnancy[]) {
    if (p.donor_horse_id) horseIds.add(p.donor_horse_id);
    if (p.stallion_horse_id) horseIds.add(p.stallion_horse_id);
    if (p.surrogate_horse_id) horseIds.add(p.surrogate_horse_id);
  }
  for (const f of recentFoalings ?? []) {
    if (f.surrogate_horse_id) horseIds.add(f.surrogate_horse_id);
    if (f.foal_horse_id) horseIds.add(f.foal_horse_id);
  }
  for (const l of recentBreedLogs ?? []) {
    if (l.horse_id) horseIds.add(l.horse_id);
  }

  const horseNames: Record<string, string> = {};
  if (horseIds.size > 0) {
    const { data: horses } = await supabase
      .from("horses")
      .select("id, name, barn_name, primary_name_pref")
      .in("id", [...horseIds]);
    for (const h of horses ?? []) {
      horseNames[h.id] = getHorseDisplayName(h);
    }
  }

  // Filter breed logs to only this barn's horses
  const barnHorseIds = new Set(Object.keys(horseNames));
  const filteredBreedLogs = (recentBreedLogs ?? []).filter(
    (l: { horse_id: string }) => barnHorseIds.has(l.horse_id) || horseIds.has(l.horse_id),
  );

  // Onboarding state + mares for the Breeders Pro wizard launcher.
  const onboardingState = await getOnboardingState(supabase, user.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: mareRows } = await (supabase as any)
    .from("horses")
    .select("id, name, breed, photo_url")
    .eq("barn_id", barnId)
    .eq("archived", false)
    .or(
      "sex.ilike.%mare%,breeding_role.in.(donor,recipient,multiple)",
    )
    .order("name", { ascending: true })
    .limit(50);
  const existingMares = ((mareRows ?? []) as Array<{
    id: string;
    name: string;
    breed: string | null;
    photo_url: string | null;
  }>);

  return (
    <>
      <BreedersProOnboardingLauncher
        barnId={barnId}
        onboardingState={onboardingState}
        existingMares={existingMares}
      />
      <OverviewClient
      metrics={{
        activePregnancies: (pregnancies ?? []).length,
        embryosInBank: (embryos ?? []).length,
        donorCount: donors?.length ?? 0,
        stallionCount: stallions?.length ?? 0,
        surrogateCount: surrogates?.length ?? 0,
        foalsThisSeason: foalingsThisYear?.length ?? 0,
      }}
      pregnancies={(pregnancies ?? []) as Pregnancy[]}
      maresInHeat={((maresInHeat ?? []) as Array<{
        id: string;
        name: string;
        barn_name: string | null;
        primary_name_pref: "papered" | "barn";
      }>).map((m) => ({ id: m.id, name: getHorseDisplayName(m) }))}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recentBreedLogs={filteredBreedLogs as any[]}
      horseNames={horseNames}
    />
    </>
  );
}
