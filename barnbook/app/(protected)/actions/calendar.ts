"use server";

import { createServerComponentClient } from "@/lib/supabase-server";
import { getHorseDisplayName } from "@/lib/horse-name";
import { revalidatePath } from "next/cache";

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  classNames: string[];
  extendedProps: {
    kind: "activity" | "health";
    logType: string;
    horseId: string;
    horseName: string;
    notes: string | null;
    performedByName: string | null;
    performedByUserId: string | null;
    totalCost: number | null;
    loggedBy: string | null;
    details: Record<string, unknown> | null;
    entryId: string;
    /** 'planned' = scheduled for the future and not yet done;
     *  'completed' = real work already performed. Drives the dashed
     *  border on the calendar event and the Mark-done action. */
    status: "planned" | "completed";
    /** Survives the planned→completed flip so the popover can show a
     *  small "Scheduled ✓" badge on completed entries that were
     *  planned ahead. */
    wasScheduled: boolean;
  };
}

import { getLogTypeColor, getLogTypeLabel } from "@/lib/logTypeColors";

export interface CalendarFilters {
  barnId: string;
  start: string;
  end: string;
  horses?: string[];
  types?: string[];
  performers?: string[];
  minCost?: number;
  maxCost?: number;
  hasNotes?: boolean;
  hasCost?: boolean;
  scheduled?: "all" | "scheduled" | "completed";
  keyword?: string;
  /** When true, treat barnId as a Service Barn: include quick-record
   *  horses (any creator's entries) AND linked horses (only the
   *  current user's own entries). Used by the Service Barn calendar
   *  to show "my work calendar" scoped to this provider. */
  serviceBarnMode?: boolean;
}

export async function getCalendarEvents(
  filters: CalendarFilters,
): Promise<{ events: CalendarEvent[]; error?: string }> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { events: [], error: "Not authenticated" };

  // Get horses in this barn. For a standard barn this is a single query
  // scoped to barn_id. For a Service Barn (serviceBarnMode) we gather
  // quick records at the Service Barn PLUS linked horses at other barns
  // — the latter requires a linkedHorseIds set so we can filter their
  // entries below to logged_by = user.id.
  const linkedHorseIds = new Set<string>();
  let horseRows: Array<{
    id: string;
    name: string;
    barn_name: string | null;
    primary_name_pref: "papered" | "barn";
  }> = [];

  if (filters.serviceBarnMode) {
    const [quickRes, linksRes] = await Promise.all([
      supabase
        .from("horses")
        .select("id, name, barn_name, primary_name_pref")
        .eq("barn_id", filters.barnId)
        .eq("is_quick_record", true)
        .eq("archived", false),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from("service_barn_links")
        .select("horse_id")
        .eq("service_barn_id", filters.barnId),
    ]);
    const quickHorses = (quickRes.data ?? []) as typeof horseRows;
    const linkIds = ((linksRes.data ?? []) as Array<{ horse_id: string }>).map(
      (l) => l.horse_id,
    );
    let linkedHorses: typeof horseRows = [];
    if (linkIds.length > 0) {
      const { data } = await supabase
        .from("horses")
        .select("id, name, barn_name, primary_name_pref")
        .in("id", linkIds)
        .eq("archived", false);
      linkedHorses = (data ?? []) as typeof horseRows;
      for (const h of linkedHorses) linkedHorseIds.add(h.id);
    }
    horseRows = [...quickHorses, ...linkedHorses];
    if (filters.horses && filters.horses.length > 0) {
      const allowed = new Set(filters.horses);
      horseRows = horseRows.filter((h) => allowed.has(h.id));
    }
  } else {
    let horseQuery = supabase
      .from("horses")
      .select("id, name, barn_name, primary_name_pref")
      .eq("barn_id", filters.barnId)
      .eq("archived", false);
    if (filters.horses && filters.horses.length > 0) {
      horseQuery = horseQuery.in("id", filters.horses);
    }
    const { data } = await horseQuery;
    horseRows = (data ?? []) as typeof horseRows;
  }

  if (horseRows.length === 0) return { events: [] };

  const horses = horseRows;
  const horseIds = horses.map((h) => h.id);
  const horseNameMap = new Map(horses.map((h) => [h.id, getHorseDisplayName(h)]));

  const now = new Date().toISOString();
  const events: CalendarEvent[] = [];

  // ── Fetch activity_log ──
  let actQuery = supabase
    .from("activity_log")
    .select("*")
    .in("horse_id", horseIds)
    .gte("performed_at", filters.start)
    .lte("performed_at", filters.end)
    .order("performed_at", { ascending: true });

  if (filters.types && filters.types.length > 0) {
    const baseActivityTypes = ["exercise", "feed", "medication", "note"];
    const breedSubtypeFilters = ["heat_detected", "bred_ai", "ultrasound", "flush_embryo", "embryo_transfer", "foaling"];

    const activityTypes = filters.types.filter((t) => baseActivityTypes.includes(t));
    const hasBreedSubtypes = filters.types.some((t) => breedSubtypeFilters.includes(t));

    // If any breed subtype is selected, include breed_data in the query
    // (client-side filtering will handle the subtype matching)
    if (hasBreedSubtypes) activityTypes.push("breed_data");

    if (activityTypes.length > 0) {
      actQuery = actQuery.in("activity_type", activityTypes);
    } else {
      // No activity types selected, skip activity query
      actQuery = actQuery.eq("activity_type", "__none__");
    }
  }

  if (filters.performers && filters.performers.length > 0) {
    actQuery = actQuery.in("performed_by_user_id", filters.performers);
  }

  if (filters.minCost !== undefined) {
    actQuery = actQuery.gte("total_cost", filters.minCost);
  }
  if (filters.maxCost !== undefined) {
    actQuery = actQuery.lte("total_cost", filters.maxCost);
  }
  if (filters.hasNotes) {
    actQuery = actQuery.not("notes", "is", null).neq("notes", "");
  }
  if (filters.hasCost) {
    actQuery = actQuery.not("total_cost", "is", null);
  }

  const { data: activities } = await actQuery;

  // Breed data subtype keys for filter matching
  const BREED_SUBTYPES = ["heat_detected", "bred_ai", "ultrasound", "flush_embryo", "embryo_transfer", "foaling"];

  for (const a of activities ?? []) {
    const performedAt = a.performed_at ?? a.created_at;
    const isFuture = performedAt > now;
    // `status` is the source of truth; `isFuture` stays as a visual
    // fallback for rows without an explicit status (and for completed
    // entries that happen to be dated in the future — rare, but
    // possible when a user schedules a real log entry ahead).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const aStatus = ((a as any).status as "planned" | "completed" | undefined) ?? "completed";
    const isPlanned = aStatus === "planned";

    // For breed_data, use the subtype for color and filtering
    const details = (a.details ?? {}) as Record<string, string>;
    const breedSubtype = a.activity_type === "breed_data" ? (details.breed_subtype ?? "custom") : null;
    const effectiveType = breedSubtype ?? a.activity_type;
    const color = getLogTypeColor(effectiveType);

    // The `scheduled` filter is now status-driven: planned vs completed.
    // Pre-status rows surface as "completed" (the default migration value).
    if (filters.scheduled === "scheduled" && !isPlanned) continue;
    if (filters.scheduled === "completed" && isPlanned) continue;

    // Filter breed_data by subtype when type filters are active
    if (breedSubtype && filters.types && filters.types.length > 0) {
      if (!filters.types.includes(breedSubtype)) continue;
    }

    if (
      filters.keyword &&
      !((a.notes ?? "").toLowerCase().includes(filters.keyword.toLowerCase()) ||
        (a.performed_by_name ?? "").toLowerCase().includes(filters.keyword.toLowerCase()))
    ) {
      continue;
    }

    // Service Barn: linked horses' entries only count as "my work" if
    // this user logged them. Skip other providers' entries on the same
    // horse so the calendar stays a personal workday view.
    if (
      filters.serviceBarnMode &&
      linkedHorseIds.has(a.horse_id) &&
      a.logged_by !== user.id
    ) {
      continue;
    }

    const endTime = new Date(new Date(performedAt).getTime() + 30 * 60 * 1000).toISOString();

    const dim = isPlanned || isFuture;
    const classNames: string[] = [];
    if (dim) classNames.push("fc-event-scheduled");
    if (isPlanned) classNames.push("fc-event-planned");

    events.push({
      id: `activity-${a.id}`,
      title: `${getLogTypeLabel(effectiveType)} — ${horseNameMap.get(a.horse_id) ?? "Horse"}`,
      start: performedAt,
      end: endTime,
      backgroundColor: dim ? `${color}20` : color,
      borderColor: color,
      textColor: dim ? color : "#ffffff",
      classNames,
      extendedProps: {
        kind: "activity",
        logType: effectiveType,
        horseId: a.horse_id,
        horseName: horseNameMap.get(a.horse_id) ?? "Horse",
        notes: a.notes,
        performedByName: a.performed_by_name,
        performedByUserId: a.performed_by_user_id,
        totalCost: a.total_cost,
        loggedBy: a.logged_by,
        details: a.details as Record<string, unknown> | null,
        entryId: a.id,
        status: aStatus,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        wasScheduled: ((a as any).was_scheduled as boolean | undefined) === true,
      },
    });
  }

  // ── Fetch health_records ──
  let healthQuery = supabase
    .from("health_records")
    .select("*")
    .in("horse_id", horseIds)
    .order("performed_at", { ascending: true });

  // Health records may use performed_at or record_date
  // We filter on both to catch entries
  healthQuery = healthQuery.or(
    `performed_at.gte.${filters.start},record_date.gte.${filters.start.slice(0, 10)}`,
  );

  if (filters.types && filters.types.length > 0) {
    const healthTypes = filters.types.filter((t) =>
      ["shoeing", "worming", "vet_visit"].includes(t),
    );
    if (healthTypes.length > 0) {
      const typeMap: Record<string, string> = {
        shoeing: "Shoeing",
        worming: "Worming",
        vet_visit: "Vet visit",
      };
      healthQuery = healthQuery.in(
        "record_type",
        healthTypes.map((t) => typeMap[t] ?? t),
      );
    }
  }

  if (filters.performers && filters.performers.length > 0) {
    healthQuery = healthQuery.in("performed_by_user_id", filters.performers);
  }
  if (filters.minCost !== undefined) {
    healthQuery = healthQuery.gte("total_cost", filters.minCost);
  }
  if (filters.maxCost !== undefined) {
    healthQuery = healthQuery.lte("total_cost", filters.maxCost);
  }
  if (filters.hasNotes) {
    healthQuery = healthQuery.not("notes", "is", null).neq("notes", "");
  }
  if (filters.hasCost) {
    healthQuery = healthQuery.not("total_cost", "is", null);
  }

  const { data: healthRecords } = await healthQuery;

  for (const h of healthRecords ?? []) {
    const performedAt = h.performed_at ?? h.record_date ?? h.created_at;
    if (!performedAt) continue;

    // Filter by end date
    if (performedAt > filters.end && (h.record_date ?? "") > filters.end.slice(0, 10)) continue;

    const isFuture = performedAt > now;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hStatus = ((h as any).status as "planned" | "completed" | undefined) ?? "completed";
    const isPlanned = hStatus === "planned";
    const typeKey = h.record_type?.toLowerCase().replace(" ", "_") ?? "vet_visit";
    const color = getLogTypeColor(typeKey);

    if (filters.scheduled === "scheduled" && !isPlanned) continue;
    if (filters.scheduled === "completed" && isPlanned) continue;

    if (
      filters.keyword &&
      !((h.notes ?? "").toLowerCase().includes(filters.keyword.toLowerCase()) ||
        (h.performed_by_name ?? "").toLowerCase().includes(filters.keyword.toLowerCase()))
    ) {
      continue;
    }

    // Service Barn linked-horse scoping (same rule as activity above):
    // only the current user's own entries count as "my work."
    if (
      filters.serviceBarnMode &&
      linkedHorseIds.has(h.horse_id) &&
      h.logged_by !== user.id
    ) {
      continue;
    }

    const endTime = new Date(new Date(performedAt).getTime() + 30 * 60 * 1000).toISOString();

    const dim = isPlanned || isFuture;
    const classNames: string[] = [];
    if (dim) classNames.push("fc-event-scheduled");
    if (isPlanned) classNames.push("fc-event-planned");

    events.push({
      id: `health-${h.id}`,
      title: `${h.record_type} — ${horseNameMap.get(h.horse_id) ?? "Horse"}`,
      start: performedAt,
      end: endTime,
      backgroundColor: dim ? `${color}20` : color,
      borderColor: color,
      textColor: dim ? color : "#ffffff",
      classNames,
      extendedProps: {
        kind: "health",
        logType: typeKey,
        horseId: h.horse_id,
        horseName: horseNameMap.get(h.horse_id) ?? "Horse",
        notes: h.notes,
        performedByName: h.performed_by_name,
        performedByUserId: h.performed_by_user_id,
        totalCost: h.total_cost,
        loggedBy: h.logged_by,
        details: h.details as Record<string, unknown> | null,
        entryId: h.id,
        status: hStatus,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        wasScheduled: ((h as any).was_scheduled as boolean | undefined) === true,
      },
    });
  }

  return { events };
}

/** Reschedule a log entry by updating performed_at */
export async function rescheduleLogEntry(
  kind: "activity" | "health",
  entryId: string,
  newPerformedAt: string,
): Promise<{ error?: string }> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const table = kind === "activity" ? "activity_log" : "health_records";

  const { error } = await supabase
    .from(table)
    .update({ performed_at: newPerformedAt })
    .eq("id", entryId);

  if (error) return { error: error.message };

  revalidatePath("/calendar");
  return {};
}

/** Get today's events + upcoming 7 days for the dashboard widget */
export async function getTodayAndUpcoming(barnId: string): Promise<{
  today: CalendarEvent[];
  upcoming: CalendarEvent[];
}> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();
  const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const todayResult = await getCalendarEvents({
    barnId,
    start: todayStart,
    end: todayEnd,
  });

  const upcomingResult = await getCalendarEvents({
    barnId,
    start: todayEnd,
    end: weekEnd,
  });

  return {
    today: todayResult.events.sort((a, b) => a.start.localeCompare(b.start)),
    upcoming: upcomingResult.events.sort((a, b) => a.start.localeCompare(b.start)),
  };
}
