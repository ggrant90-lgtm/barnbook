import { getPrimaryBarnContext } from "@/lib/barn-session";
import { canUserEditHorse } from "@/lib/horse-access";
import { createServerComponentClient } from "@/lib/supabase-server";
import type { Horse } from "@/lib/types";
import { redirect } from "next/navigation";
import { HorsesGrid } from "./HorsesGrid";

export default async function HorsesPage() {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const ctx = await getPrimaryBarnContext(supabase, user.id);
  if (!ctx) redirect("/dashboard");

  const { data: horsesRaw, error } = await supabase
    .from("horses")
    .select("*")
    .eq("barn_id", ctx.barn.id)
    .order("name", { ascending: true });

  if (error) {
    return (
      <div className="px-4 py-10 text-barn-red">
        Could not load horses: {error.message}
      </div>
    );
  }

  // Also fetch horses visiting this barn via active stays
  const { data: activeStays } = await supabase
    .from("horse_stays")
    .select("horse_id, home_barn_id")
    .eq("host_barn_id", ctx.barn.id)
    .eq("status", "active");

  let visitingHorses: Horse[] = [];
  if (activeStays && activeStays.length > 0) {
    const visitIds = activeStays.map((s) => s.horse_id);
    const { data: vHorses } = await supabase
      .from("horses")
      .select("*")
      .in("id", visitIds);
    visitingHorses = (vHorses ?? []) as Horse[];
  }

  // Get home barn names for visiting horses
  const homeBarnIds = [...new Set((activeStays ?? []).map((s) => s.home_barn_id))];
  const homeBarnNames: Record<string, string> = {};
  if (homeBarnIds.length > 0) {
    const { data: hBarns } = await supabase
      .from("barns")
      .select("id, name")
      .in("id", homeBarnIds);
    for (const b of hBarns ?? []) {
      homeBarnNames[b.id] = b.name;
    }
  }

  // Build visiting info map: horse_id -> home barn name
  const visitingInfo: Record<string, string> = {};
  for (const s of activeStays ?? []) {
    visitingInfo[s.horse_id] = homeBarnNames[s.home_barn_id] ?? "Another barn";
  }

  // Also check which of our horses are away
  const { data: awayStays } = await supabase
    .from("horse_stays")
    .select("horse_id, host_barn_id")
    .eq("home_barn_id", ctx.barn.id)
    .eq("status", "active");

  const awayBarnIds = [...new Set((awayStays ?? []).map((s) => s.host_barn_id))];
  const awayBarnNames: Record<string, string> = {};
  if (awayBarnIds.length > 0) {
    const { data: aBarns } = await supabase
      .from("barns")
      .select("id, name")
      .in("id", awayBarnIds);
    for (const b of aBarns ?? []) {
      awayBarnNames[b.id] = b.name;
    }
  }
  const awayInfo: Record<string, string> = {};
  for (const s of awayStays ?? []) {
    awayInfo[s.horse_id] = awayBarnNames[s.host_barn_id] ?? "Mare Motel";
  }

  const allHorses = [...(horsesRaw ?? []) as Horse[], ...visitingHorses];
  const canAdd = await canUserEditHorse(supabase, user.id, ctx.barn.id);

  return <HorsesGrid horses={allHorses} canAdd={canAdd} visitingInfo={visitingInfo} awayInfo={awayInfo} />;
}
