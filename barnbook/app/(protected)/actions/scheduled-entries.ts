"use server";

import { revalidatePath } from "next/cache";
import { canUserEditHorse } from "@/lib/horse-access";
import { createAdminClient } from "@/lib/supabase-admin";
import { createServerComponentClient } from "@/lib/supabase-server";
import { isLogType, type LogType } from "@/lib/horse-form-constants";

/**
 * Server actions for Service Barn scheduled (planned) log entries.
 *
 * These create/mutate rows in `activity_log` and `health_records` with
 * `status = 'planned'`. Normal log creation still goes through
 * `createLogAction` — this file is only for the schedule-ahead path.
 *
 * Access pattern mirrors the other mutation actions (4d18c68):
 *   1. Verify the caller via the server-component client's auth.getUser.
 *   2. Run the edit-permission check at the app layer.
 *   3. Perform the write via the admin client, because a few of the
 *      RLS policies on activity_log / health_records have been flaky
 *      in server-action contexts when `auth.uid()` gets lost.
 */

const ACTIVITY_TYPES = new Set<LogType>([
  "exercise",
  "pony",
  "feed",
  "medication",
  "note",
  "breed_data",
]);
const HEALTH_TYPES = new Set<LogType>(["shoeing", "worming", "vet_visit", "dentistry"]);

/** 'activity' → activity_log, 'health' → health_records. */
export type LogKind = "activity" | "health";

function logKindForType(t: LogType): LogKind {
  return HEALTH_TYPES.has(t) ? "health" : "activity";
}

function healthRecordType(t: LogType): string {
  if (t === "shoeing") return "Shoeing";
  if (t === "worming") return "Worming";
  if (t === "dentistry") return "Dentistry";
  return "Vet visit";
}

function midday(isoDate: string): string {
  // Store planned entries at noon UTC so they consistently render on
  // the intended local calendar day — avoids the "midnight rolls over
  // into yesterday" issue for negative-offset timezones.
  return new Date(`${isoDate}T12:00:00Z`).toISOString();
}

/**
 * Create a scheduled (future or past-dated-planned) log entry.
 * The row is inserted with the minimum fields the rest of the app
 * already tolerates: type + date + optional notes/cost. Everything
 * else is nullable.
 */
export async function scheduleEntryAction(
  horseId: string,
  typeRaw: string,
  input: {
    /** ISO date, e.g. 2026-06-12 */
    date: string;
    notes?: string;
    cost?: number;
  },
): Promise<{ id: string; kind: LogKind } | { error: string }> {
  const t = typeRaw.toLowerCase();
  if (!isLogType(t)) return { error: "Invalid log type" };
  const logType = t as LogType;

  if (!input.date || Number.isNaN(new Date(input.date).getTime())) {
    return { error: "Pick a valid date to schedule." };
  }

  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: horse } = await supabase
    .from("horses")
    .select("barn_id")
    .eq("id", horseId)
    .single();
  if (!horse) return { error: "Horse not found" };

  const canEdit = await canUserEditHorse(supabase, user.id, horse.barn_id);
  if (!canEdit) return { error: "No permission to schedule for this horse." };

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;

  const notes = input.notes?.trim() || null;
  const total_cost =
    typeof input.cost === "number" && !Number.isNaN(input.cost)
      ? input.cost
      : null;
  const performed_at = midday(input.date);

  const kind = logKindForType(logType);

  if (kind === "activity") {
    if (!ACTIVITY_TYPES.has(logType)) return { error: "Invalid log type" };
    const { data, error } = await db
      .from("activity_log")
      .insert({
        horse_id: horseId,
        logged_by: user.id,
        activity_type: logType,
        notes,
        distance: null,
        duration_minutes: 0,
        speed_avg: null,
        details: {},
        logged_at_barn_id: horse.barn_id,
        performed_by_user_id: user.id,
        performed_by_name: null,
        performed_at,
        total_cost,
        status: "planned",
        was_scheduled: true,
      })
      .select("id")
      .single();
    if (error) return { error: error.message };
    revalidatePaths(horseId);
    return { id: data.id as string, kind: "activity" };
  }

  // health
  const { data, error } = await db
    .from("health_records")
    .insert({
      horse_id: horseId,
      record_type: healthRecordType(logType),
      provider_name: null,
      description: null,
      notes,
      record_date: input.date,
      next_due_date: null,
      document_url: null,
      details: {},
      logged_by: user.id,
      logged_at_barn_id: horse.barn_id,
      performed_by_user_id: user.id,
      performed_by_name: null,
      performed_at,
      total_cost,
      status: "planned",
      was_scheduled: true,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePaths(horseId);
  return { id: data.id as string, kind: "health" };
}

/**
 * Flip a planned entry to completed. Snaps `performed_at` /
 * `record_date` to now so the entry lands at today's date in the
 * horse's activity history. The optional `cost` and `notes` let the
 * user capture the actual outcome at the moment of completion — they
 * overwrite whatever placeholder values were on the planned row.
 * A null/undefined cost leaves the existing value; an empty-string
 * notes field likewise leaves the existing value (use a space or
 * explicit clear if you truly mean to blank it).
 */
export async function markEntryCompletedAction(
  logId: string,
  kind: LogKind,
  input?: { cost?: number | null; notes?: string | null },
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;

  // Pull horse_id for the access check + revalidation.
  const table = kind === "activity" ? "activity_log" : "health_records";
  const { data: row } = await db
    .from(table)
    .select("id, horse_id, status")
    .eq("id", logId)
    .single();
  if (!row) return { error: "Entry not found" };
  if (row.status !== "planned") {
    return { error: "Entry is already marked done." };
  }

  const { data: horse } = await supabase
    .from("horses")
    .select("barn_id")
    .eq("id", row.horse_id)
    .single();
  if (!horse) return { error: "Horse not found" };

  const canEdit = await canUserEditHorse(supabase, user.id, horse.barn_id);
  if (!canEdit) return { error: "No permission to mark this entry done." };

  const now = new Date();
  const nowIso = now.toISOString();
  const todayDate = nowIso.slice(0, 10);

  const update: Record<string, unknown> =
    kind === "activity"
      ? { status: "completed", performed_at: nowIso }
      : { status: "completed", performed_at: nowIso, record_date: todayDate };

  // Optional fill-in at completion. cost=undefined leaves the existing
  // value; cost=null explicitly clears it. notes follows the same rule,
  // but we also treat an empty-trimmed string as "don't overwrite."
  if (input?.cost !== undefined) {
    update.total_cost = input.cost;
    // If the provider is setting a non-null cost and nothing already
    // marked this as revenue, default to revenue — matches the
    // service-provider heuristic used by QuickLogForm.
    if (input.cost != null) update.cost_type = "revenue";
  }
  if (input?.notes !== undefined) {
    const trimmed = input.notes?.trim();
    if (trimmed !== undefined && trimmed !== "") {
      update.notes = trimmed;
    } else if (input.notes === null) {
      update.notes = null;
    }
  }

  const { error } = await db.from(table).update(update).eq("id", logId);
  if (error) return { error: error.message };

  revalidatePaths(row.horse_id);
  return { ok: true };
}

/**
 * Change the date of a planned entry. Does not flip status.
 */
export async function rescheduleEntryAction(
  logId: string,
  kind: LogKind,
  newDate: string,
): Promise<{ ok: true } | { error: string }> {
  if (!newDate || Number.isNaN(new Date(newDate).getTime())) {
    return { error: "Pick a valid date." };
  }

  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;

  const table = kind === "activity" ? "activity_log" : "health_records";
  const { data: row } = await db
    .from(table)
    .select("id, horse_id, status")
    .eq("id", logId)
    .single();
  if (!row) return { error: "Entry not found" };
  if (row.status !== "planned") {
    return { error: "Only planned entries can be rescheduled." };
  }

  const { data: horse } = await supabase
    .from("horses")
    .select("barn_id")
    .eq("id", row.horse_id)
    .single();
  if (!horse) return { error: "Horse not found" };

  const canEdit = await canUserEditHorse(supabase, user.id, horse.barn_id);
  if (!canEdit) return { error: "No permission to reschedule this entry." };

  const performed_at = midday(newDate);
  const update: Record<string, unknown> =
    kind === "activity"
      ? { performed_at }
      : { performed_at, record_date: newDate };

  const { error } = await db.from(table).update(update).eq("id", logId);
  if (error) return { error: error.message };

  revalidatePaths(row.horse_id);
  return { ok: true };
}

/**
 * Delete a planned entry. Defensive WHERE on status='planned' so a
 * completed row can never be removed by this action even if the logId
 * is somehow wrong.
 */
export async function cancelScheduledEntryAction(
  logId: string,
  kind: LogKind,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;

  const table = kind === "activity" ? "activity_log" : "health_records";
  const { data: row } = await db
    .from(table)
    .select("id, horse_id, status")
    .eq("id", logId)
    .single();
  if (!row) return { error: "Entry not found" };
  if (row.status !== "planned") {
    return { error: "Only planned entries can be cancelled." };
  }

  const { data: horse } = await supabase
    .from("horses")
    .select("barn_id")
    .eq("id", row.horse_id)
    .single();
  if (!horse) return { error: "Horse not found" };

  const canEdit = await canUserEditHorse(supabase, user.id, horse.barn_id);
  if (!canEdit) return { error: "No permission to cancel this entry." };

  const { error } = await db
    .from(table)
    .delete()
    .eq("id", logId)
    .eq("status", "planned");
  if (error) return { error: error.message };

  revalidatePaths(row.horse_id);
  return { ok: true };
}

function revalidatePaths(horseId: string) {
  revalidatePath(`/horses/${horseId}`);
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  // Service Barn dashboards aren't at a knowable URL without the barn
  // id — revalidate the layout so all service pages refresh.
  revalidatePath("/", "layout");
}
