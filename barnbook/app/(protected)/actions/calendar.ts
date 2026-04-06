"use server";

import { createServerComponentClient } from "@/lib/supabase-server";
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
  };
}

import { getLogTypeColor } from "@/lib/logTypeColors";

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
}

export async function getCalendarEvents(
  filters: CalendarFilters,
): Promise<{ events: CalendarEvent[]; error?: string }> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { events: [], error: "Not authenticated" };

  // Get horses in this barn
  let horseQuery = supabase
    .from("horses")
    .select("id, name")
    .eq("barn_id", filters.barnId)
    .eq("archived", false);

  if (filters.horses && filters.horses.length > 0) {
    horseQuery = horseQuery.in("id", filters.horses);
  }

  const { data: horses } = await horseQuery;
  if (!horses || horses.length === 0) return { events: [] };

  const horseIds = horses.map((h) => h.id);
  const horseNameMap = new Map(horses.map((h) => [h.id, h.name]));

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
    const activityTypes = filters.types.filter((t) =>
      ["exercise", "feed", "medication", "note", "breed_data"].includes(t),
    );
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

  for (const a of activities ?? []) {
    const performedAt = a.performed_at ?? a.created_at;
    const isFuture = performedAt > now;
    const color = getLogTypeColor(a.activity_type);

    if (filters.scheduled === "scheduled" && !isFuture) continue;
    if (filters.scheduled === "completed" && isFuture) continue;

    if (
      filters.keyword &&
      !((a.notes ?? "").toLowerCase().includes(filters.keyword.toLowerCase()) ||
        (a.performed_by_name ?? "").toLowerCase().includes(filters.keyword.toLowerCase()))
    ) {
      continue;
    }

    const endTime = new Date(new Date(performedAt).getTime() + 30 * 60 * 1000).toISOString();

    events.push({
      id: `activity-${a.id}`,
      title: `${a.activity_type.charAt(0).toUpperCase() + a.activity_type.slice(1).replace("_", " ")} — ${horseNameMap.get(a.horse_id) ?? "Horse"}`,
      start: performedAt,
      end: endTime,
      backgroundColor: isFuture ? `${color}20` : color,
      borderColor: color,
      textColor: isFuture ? color : "#ffffff",
      classNames: isFuture ? ["fc-event-scheduled"] : [],
      extendedProps: {
        kind: "activity",
        logType: a.activity_type,
        horseId: a.horse_id,
        horseName: horseNameMap.get(a.horse_id) ?? "Horse",
        notes: a.notes,
        performedByName: a.performed_by_name,
        performedByUserId: a.performed_by_user_id,
        totalCost: a.total_cost,
        loggedBy: a.logged_by,
        details: a.details as Record<string, unknown> | null,
        entryId: a.id,
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
    const typeKey = h.record_type?.toLowerCase().replace(" ", "_") ?? "vet_visit";
    const color = getLogTypeColor(typeKey);

    if (filters.scheduled === "scheduled" && !isFuture) continue;
    if (filters.scheduled === "completed" && isFuture) continue;

    if (
      filters.keyword &&
      !((h.notes ?? "").toLowerCase().includes(filters.keyword.toLowerCase()) ||
        (h.performed_by_name ?? "").toLowerCase().includes(filters.keyword.toLowerCase()))
    ) {
      continue;
    }

    const endTime = new Date(new Date(performedAt).getTime() + 30 * 60 * 1000).toISOString();

    events.push({
      id: `health-${h.id}`,
      title: `${h.record_type} — ${horseNameMap.get(h.horse_id) ?? "Horse"}`,
      start: performedAt,
      end: endTime,
      backgroundColor: isFuture ? `${color}20` : color,
      borderColor: color,
      textColor: isFuture ? color : "#ffffff",
      classNames: isFuture ? ["fc-event-scheduled"] : [],
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
