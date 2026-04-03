import { getPrimaryBarnContext } from "@/lib/barn-session";
import { canManageBarnKeys } from "@/lib/key-access";
import { createServerComponentClient } from "@/lib/supabase-server";
import type { AccessKey, KeyRequest } from "@/lib/types";
import { redirect } from "next/navigation";
import { KeysDashboardClient } from "./KeysDashboardClient";

export default async function KeysPage({
  searchParams,
}: {
  searchParams: Promise<{ horse?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const ctx = await getPrimaryBarnContext(supabase, user.id);
  if (!ctx) redirect("/dashboard");

  const barnId = ctx.barn.id;
  const canManage = await canManageBarnKeys(supabase, user.id, barnId);
  if (!canManage) redirect("/dashboard");

  const [{ data: keyRows }, { data: horsesData }, { data: reqRows }] = await Promise.all([
    supabase.from("access_keys").select("*").eq("barn_id", barnId).order("created_at", { ascending: false }),
    supabase.from("horses").select("id, name").eq("barn_id", barnId).order("name", { ascending: true }),
    supabase
      .from("key_requests")
      .select("*")
      .eq("barn_id", barnId)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
  ]);

  const keys = (keyRows ?? []) as AccessKey[];
  const barnKeys = keys.filter((k) => k.key_type === "barn");
  const stallKeys = keys.filter((k) => k.key_type === "stall");

  const horses = horsesData ?? [];
  const nameByHorse = new Map(horses.map((h) => [h.id, h.name]));

  const stallByHorseMap = new Map<string, AccessKey[]>();
  for (const k of stallKeys) {
    const hid = k.horse_id;
    if (!hid) continue;
    if (!stallByHorseMap.has(hid)) stallByHorseMap.set(hid, []);
    stallByHorseMap.get(hid)!.push(k);
  }

  const stallByHorse = [...stallByHorseMap.entries()].map(([horseId, ks]) => ({
    horseId,
    horseName: nameByHorse.get(horseId) ?? "Horse",
    keys: ks,
  }));

  const pendingRequests = (reqRows ?? []) as KeyRequest[];
  const reqIds = [...new Set(pendingRequests.map((r) => r.requester_id))];
  let requesterNames: Record<string, string> = {};
  if (reqIds.length > 0) {
    const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", reqIds);
    requesterNames = Object.fromEntries(
      (profs ?? []).map((p) => [p.id, p.full_name?.trim() || "Member"]),
    );
  }

  const horseOptions = horses.map((h) => ({ id: h.id, name: h.name }));
  const prefillHorseId = sp.horse?.trim() || null;

  return (
    <KeysDashboardClient
      barnName={ctx.barn.name}
      barnKeys={barnKeys}
      stallByHorse={stallByHorse}
      horseOptions={horseOptions}
      pendingRequests={pendingRequests}
      requesterNames={requesterNames}
      prefillHorseId={prefillHorseId}
    />
  );
}
