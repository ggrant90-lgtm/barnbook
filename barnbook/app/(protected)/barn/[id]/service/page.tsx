import { notFound, redirect } from "next/navigation";
import { createServerComponentClient } from "@/lib/supabase-server";
import type { Barn, Horse, ServiceBarnLink } from "@/lib/types";
import { ServiceBarnDashboard } from "./ServiceBarnDashboard";
import type { UpcomingEntry } from "./UpcomingStrip";

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

  // ── Upcoming planned entries (overdue + next 14 days) ──
  // Same scoping rule as the week-stats query: quick records include any
  // creator's entries, linked horses only include this user's own.
  // eslint-disable-next-line react-hooks/purity
  const upcomingNowMs = Date.now();
  const windowStart = new Date(upcomingNowMs - 7 * 24 * 60 * 60 * 1000).toISOString();
  const windowEnd = new Date(upcomingNowMs + 14 * 24 * 60 * 60 * 1000).toISOString();

  const upcomingEntries: UpcomingEntry[] = [];
  if (quickHorseIds.length + linkedHorseIds.length > 0) {
    const horseNames = new Map<string, string>([
      ...quickHorses.map((h): [string, string] => [h.id, h.name]),
      ...linkedHorses.map((lh): [string, string] => [lh.horse.id, lh.horse.name]),
    ]);
    const linkedSet = new Set(linkedHorseIds);
    const allHorseIds = [...quickHorseIds, ...linkedHorseIds];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const [actRes, hrRes] = await Promise.all([
      db
        .from("activity_log")
        .select(
          "id, horse_id, performed_at, created_at, notes, logged_by, activity_type",
        )
        .in("horse_id", allHorseIds)
        .eq("status", "planned")
        .gte("performed_at", windowStart)
        .lte("performed_at", windowEnd)
        .order("performed_at", { ascending: true }),
      db
        .from("health_records")
        .select(
          "id, horse_id, performed_at, created_at, notes, logged_by, record_type, record_date",
        )
        .in("horse_id", allHorseIds)
        .eq("status", "planned")
        .gte("performed_at", windowStart)
        .lte("performed_at", windowEnd)
        .order("performed_at", { ascending: true }),
    ]);

    type ActRow = {
      id: string;
      horse_id: string;
      performed_at: string | null;
      created_at: string;
      notes: string | null;
      logged_by: string | null;
      activity_type: string;
    };
    type HrRow = {
      id: string;
      horse_id: string;
      performed_at: string | null;
      created_at: string;
      notes: string | null;
      logged_by: string | null;
      record_type: string | null;
      record_date: string | null;
    };

    for (const a of (actRes.data ?? []) as ActRow[]) {
      // Linked horses: only show this user's own scheduled work.
      if (linkedSet.has(a.horse_id) && a.logged_by !== user.id) continue;
      const when = a.performed_at ?? a.created_at;
      upcomingEntries.push({
        id: a.id,
        kind: "activity",
        horseId: a.horse_id,
        horseName: horseNames.get(a.horse_id) ?? "Horse",
        logType: a.activity_type ?? "note",
        date: when,
        notes: a.notes,
      });
    }
    for (const h of (hrRes.data ?? []) as HrRow[]) {
      if (linkedSet.has(h.horse_id) && h.logged_by !== user.id) continue;
      const when =
        h.performed_at ??
        (h.record_date ? `${h.record_date}T12:00:00Z` : h.created_at);
      const typeKey =
        (h.record_type ?? "").toLowerCase().replace(/ /g, "_") || "vet_visit";
      upcomingEntries.push({
        id: h.id,
        kind: "health",
        horseId: h.horse_id,
        horseName: horseNames.get(h.horse_id) ?? "Horse",
        logType: typeKey,
        date: when,
        notes: h.notes,
      });
    }
    upcomingEntries.sort((a, b) => a.date.localeCompare(b.date));
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
      upcoming={upcomingEntries}
    />
  );
}
