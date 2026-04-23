import { getActiveBarnContext } from "@/lib/barn-session";
import { canManageBarnKeys } from "@/lib/key-access";
import { createServerComponentClient } from "@/lib/supabase-server";
import type { AccessKey, KeyRequest } from "@/lib/types";
import type { MemberInfo } from "@/components/MemberCard";
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

  const ctx = await getActiveBarnContext(supabase, user.id);
  if (!ctx) redirect("/dashboard");

  const barnId = ctx.barn.id;
  const canManage = await canManageBarnKeys(supabase, user.id, barnId);
  if (!canManage) redirect("/dashboard");

  const [{ data: keyRows }, { data: horsesData }, { data: reqRows }, { data: membersData }] =
    await Promise.all([
      supabase
        .from("access_keys")
        .select("*")
        .eq("barn_id", barnId)
        .order("created_at", { ascending: false }),
      supabase
        .from("horses")
        .select("id, name")
        .eq("barn_id", barnId)
        .order("name", { ascending: true }),
      supabase
        .from("key_requests")
        .select("*")
        .eq("barn_id", barnId)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabase
        .from("barn_members")
        .select("id, user_id, role, status")
        .eq("barn_id", barnId)
        .order("created_at", { ascending: true }),
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

  // Gather all user IDs we need profiles for
  const allUserIds = new Set<string>();
  for (const r of pendingRequests) allUserIds.add(r.requester_id);
  const members = membersData ?? [];
  for (const m of members) allUserIds.add(m.user_id);

  let profileMap: Record<string, { name: string; email: string | null }> = {};
  if (allUserIds.size > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", [...allUserIds]);

    profileMap = Object.fromEntries(
      (profs ?? []).map((p) => [
        p.id,
        { name: p.full_name?.trim() || "Member", email: null },
      ]),
    );
  }

  const requesterNames = Object.fromEntries(
    Object.entries(profileMap).map(([id, p]) => [id, p.name]),
  );

  // Build member info list
  const memberInfos: MemberInfo[] = members.map((m) => ({
    id: m.id,
    user_id: m.user_id,
    role: m.role,
    status: (m.status as "active" | "disabled" | null) ?? "active",
    name: profileMap[m.user_id]?.name ?? "Member",
    email: profileMap[m.user_id]?.email ?? null,
    isOwner: ctx.barn.owner_id === m.user_id,
  }));

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
      members={memberInfos}
    />
  );
}
