import { notFound, redirect } from "next/navigation";
import { createServerComponentClient } from "@/lib/supabase-server";
import type { Barn, Horse, ServiceBarnLink } from "@/lib/types";
import { ServiceBarnDashboard } from "./ServiceBarnDashboard";

/**
 * Service Barn dashboard — a service provider's mobile workspace.
 *
 * Shows a unified list of (quick records + linked horses from other
 * barns), plus provider-scoped stats and the quick-log FAB.
 *
 * Non-service barns get redirected back to the standard barn profile
 * route so this URL is only ever reached for barn_type='service'.
 */
export default async function ServiceBarnPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: barnId } = await params;
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const { data: barnRow } = await supabase
    .from("barns")
    .select("*")
    .eq("id", barnId)
    .maybeSingle();
  if (!barnRow) notFound();

  const barn = barnRow as Barn;
  if (barn.owner_id !== user.id) redirect(`/barn/${barnId}`);
  if (barn.barn_type !== "service") redirect(`/barn/${barnId}`);

  // Quick records in this Service Barn.
  const { data: quickHorsesRaw } = await supabase
    .from("horses")
    .select("*")
    .eq("barn_id", barnId)
    .eq("is_quick_record", true)
    .eq("archived", false)
    .order("name", { ascending: true });
  const quickHorses = (quickHorsesRaw ?? []) as Horse[];

  // Linked horses: join service_barn_links with horses + owning barn.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: linkRows } = await (supabase as any)
    .from("service_barn_links")
    .select("id, horse_id, notes, created_at")
    .eq("service_barn_id", barnId);
  const links = (linkRows ?? []) as Pick<
    ServiceBarnLink,
    "id" | "horse_id" | "notes" | "created_at"
  >[];

  let linkedHorses: Array<{
    linkId: string;
    horse: Horse;
    owningBarnName: string;
    linkNotes: string | null;
  }> = [];
  if (links.length > 0) {
    const linkedIds = links.map((l) => l.horse_id);
    const { data: linkedHorseRows } = await supabase
      .from("horses")
      .select("*")
      .in("id", linkedIds)
      .eq("archived", false);
    const linkedHorseById = new Map<string, Horse>(
      ((linkedHorseRows ?? []) as Horse[]).map((h) => [h.id, h]),
    );
    const owningBarnIds = [
      ...new Set(
        ((linkedHorseRows ?? []) as Horse[]).map((h) => h.barn_id),
      ),
    ];
    const owningBarnNameById: Record<string, string> = {};
    if (owningBarnIds.length > 0) {
      const { data: barnRows } = await supabase
        .from("barns")
        .select("id, name")
        .in("id", owningBarnIds);
      for (const b of (barnRows ?? []) as { id: string; name: string }[]) {
        owningBarnNameById[b.id] = b.name;
      }
    }
    linkedHorses = links
      .map((l) => {
        const h = linkedHorseById.get(l.horse_id);
        if (!h) return null;
        return {
          linkId: l.id,
          horse: h,
          owningBarnName: owningBarnNameById[h.barn_id] ?? "Barn",
          linkNotes: l.notes,
        };
      })
      .filter(Boolean) as typeof linkedHorses;
  }

  // Stats: count of entries this week scoped to the provider's work
  // (quick records: all entries; linked horses: only logged_by = user).
  // This is a server component — Date.now() is fine here because the
  // module runs once per request, not on every render. The lint rule
  // (react-hooks/purity) targets client components.
  // eslint-disable-next-line react-hooks/purity
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const quickHorseIds = quickHorses.map((h) => h.id);
  const linkedHorseIds = linkedHorses.map((lh) => lh.horse.id);

  let entriesThisWeek = 0;
  if (quickHorseIds.length + linkedHorseIds.length > 0) {
    // Two queries — activity_log + health_records — UNIONed in JS.
    // For quick records: any creator. For linked: logged_by = user.id.
    const [actQuickRes, hrQuickRes, actLinkedRes, hrLinkedRes] = await Promise.all([
      quickHorseIds.length
        ? supabase
            .from("activity_log")
            .select("id", { count: "exact", head: true })
            .in("horse_id", quickHorseIds)
            .gte("created_at", weekAgo)
        : Promise.resolve({ count: 0 }),
      quickHorseIds.length
        ? supabase
            .from("health_records")
            .select("id", { count: "exact", head: true })
            .in("horse_id", quickHorseIds)
            .gte("created_at", weekAgo)
        : Promise.resolve({ count: 0 }),
      linkedHorseIds.length
        ? supabase
            .from("activity_log")
            .select("id", { count: "exact", head: true })
            .in("horse_id", linkedHorseIds)
            .eq("logged_by", user.id)
            .gte("created_at", weekAgo)
        : Promise.resolve({ count: 0 }),
      linkedHorseIds.length
        ? supabase
            .from("health_records")
            .select("id", { count: "exact", head: true })
            .in("horse_id", linkedHorseIds)
            .eq("logged_by", user.id)
            .gte("created_at", weekAgo)
        : Promise.resolve({ count: 0 }),
    ]);
    entriesThisWeek =
      (actQuickRes.count ?? 0) +
      (hrQuickRes.count ?? 0) +
      (actLinkedRes.count ?? 0) +
      (hrLinkedRes.count ?? 0);
  }

  return (
    <ServiceBarnDashboard
      barn={barn}
      quickHorses={quickHorses}
      linkedHorses={linkedHorses}
      stats={{
        totalHorses: quickHorses.length + linkedHorses.length,
        entriesThisWeek,
      }}
    />
  );
}
