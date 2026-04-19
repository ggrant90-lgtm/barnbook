"use server";

import { createServerComponentClient } from "@/lib/supabase-server";
import { canUserAccessHorse } from "@/lib/horse-access";
import { getHorseDisplayName } from "@/lib/horse-name";
import type { ActivityLog, HealthRecord } from "@/lib/types";

export interface ReportParams {
  reportType: "horse_summary" | "trainer_productivity" | "owner_statement" | "barn_revenue";
  barnId: string;
  dateFrom: string;
  dateTo: string;
  horseIds?: string[];
  performerUserId?: string | null;
  performerName?: string | null;
  logTypes?: string[];
  groupBy?: "type" | "performer" | "horse";
  includeLineItems?: boolean;
  includeNotes?: boolean;
  // Owner statement specific
  billToName?: string;
  billToAddress?: string;
  billToEmail?: string;
  invoiceNumber?: string;
  dueDate?: string;
}

export interface ReportEntry {
  id: string;
  source: "activity" | "health";
  performed_at: string;
  type: string;
  horse_id: string;
  horse_name: string;
  performed_by_name: string | null;
  performed_by_user_id: string | null;
  performer_display: string;
  notes: string | null;
  total_cost: number | null;
  details: Record<string, unknown> | null;
  line_items: { description: string; amount: number }[];
}

export interface ReportData {
  entries: ReportEntry[];
  barnName: string;
  barnAddress: string;
  generatedAt: string;
  generatedBy: string;
  params: ReportParams;
  // Computed summaries
  totalCost: number;
  totalEntries: number;
  uniqueHorses: number;
  uniquePerformers: number;
  costByType: Record<string, { count: number; total: number }>;
  costByHorse: Record<string, { name: string; count: number; total: number }>;
  costByPerformer: Record<string, { name: string; count: number; total: number }>;
}

export async function generateReportData(params: ReportParams): Promise<ReportData | { error: string }> {
  const supabase = await createServerComponentClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Fetch barn info
  const { data: barn } = await supabase
    .from("barns")
    .select("id, name, address, city, state, zip")
    .eq("id", params.barnId)
    .single();
  if (!barn) return { error: "Barn not found" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  // Get horses in this barn
  const { data: barnHorses } = await supabase
    .from("horses")
    .select("id, name, barn_name, primary_name_pref, owner_name")
    .eq("barn_id", params.barnId)
    .eq("archived", false);

  const allHorseIds = (barnHorses ?? []).map((h) => h.id);
  const horseNameMap = new Map(
    (barnHorses ?? []).map((h) => [h.id, getHorseDisplayName(h)]),
  );
  const horseOwnerMap = new Map((barnHorses ?? []).map((h) => [h.id, (h as { owner_name?: string }).owner_name ?? null]));

  const targetHorseIds = params.horseIds?.length
    ? params.horseIds.filter((id) => allHorseIds.includes(id))
    : allHorseIds;

  if (targetHorseIds.length === 0) return { error: "No horses found" };

  // Fetch performer profiles for display names
  const { data: members } = await supabase
    .from("barn_members")
    .select("user_id, role")
    .eq("barn_id", params.barnId);

  const memberIds = [...new Set((members ?? []).map((m) => m.user_id))];
  let profileMap = new Map<string, string>();
  if (memberIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", memberIds);
    profileMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name?.trim() || "Member"]));
  }

  const dateFrom = `${params.dateFrom}T00:00:00`;
  const dateTo = `${params.dateTo}T23:59:59`;

  // Query activity logs — use .or() to catch entries by performed_at OR created_at.
  // Raise row limit to 5000 to avoid silent truncation.
  let actQuery = supabase
    .from("activity_log")
    .select("*")
    .in("horse_id", targetHorseIds)
    .or(`performed_at.gte.${dateFrom},created_at.gte.${dateFrom}`)
    .order("created_at", { ascending: true })
    .limit(5000);

  if (params.performerUserId) {
    actQuery = actQuery.eq("performed_by_user_id", params.performerUserId);
  } else if (params.performerName) {
    actQuery = actQuery.eq("performed_by_name", params.performerName);
  }

  const { data: actLogsRaw } = await actQuery;

  // Precise client-side date filter (handles entries with only created_at)
  const actLogs = (actLogsRaw ?? []).filter((a) => {
    const d = a.performed_at || a.created_at;
    if (!d) return false;
    return d >= dateFrom && d <= dateTo;
  });

  // Query health records — same approach with .or() and raised limit
  let healthQuery = supabase
    .from("health_records")
    .select("*")
    .in("horse_id", targetHorseIds)
    .or(`performed_at.gte.${dateFrom},record_date.gte.${params.dateFrom},created_at.gte.${dateFrom}`)
    .order("created_at", { ascending: true })
    .limit(5000);

  if (params.performerUserId) {
    healthQuery = healthQuery.eq("performed_by_user_id", params.performerUserId);
  } else if (params.performerName) {
    healthQuery = healthQuery.eq("performed_by_name", params.performerName);
  }

  const { data: healthLogs } = await healthQuery;

  // Precise client-side date filter for health records
  const filteredHealth = (healthLogs ?? []).filter((h) => {
    const d = h.performed_at || h.record_date || h.created_at;
    if (!d) return false;
    const dateStr = typeof d === "string" && d.length === 10 ? `${d}T00:00:00` : d;
    return dateStr >= dateFrom && dateStr <= dateTo;
  });

  // Merge into unified entries
  const allEntryIds: { type: "activity" | "health"; id: string }[] = [];
  const entries: ReportEntry[] = [];

  for (const log of (actLogs ?? []) as ActivityLog[]) {
    if (params.logTypes?.length && !params.logTypes.includes(log.activity_type)) continue;

    allEntryIds.push({ type: "activity", id: log.id });
    entries.push({
      id: log.id,
      source: "activity",
      performed_at: log.performed_at || log.created_at,
      type: log.activity_type,
      horse_id: log.horse_id,
      horse_name: horseNameMap.get(log.horse_id) ?? "Unknown",
      performed_by_name: log.performed_by_name,
      performed_by_user_id: log.performed_by_user_id,
      performer_display: log.performed_by_user_id
        ? profileMap.get(log.performed_by_user_id) ?? log.performed_by_name ?? "Unknown"
        : log.performed_by_name ?? "—",
      notes: params.includeNotes !== false ? log.notes : null,
      total_cost: log.total_cost,
      details: log.details as Record<string, unknown> | null,
      line_items: [],
    });
  }

  for (const rec of filteredHealth as HealthRecord[]) {
    const recType = rec.record_type?.toLowerCase().replace(/\s+/g, "_") ?? "health";
    if (params.logTypes?.length && !params.logTypes.includes(recType) && !params.logTypes.includes(rec.record_type)) continue;

    allEntryIds.push({ type: "health", id: rec.id });
    entries.push({
      id: rec.id,
      source: "health",
      performed_at: rec.performed_at || rec.record_date || rec.created_at,
      type: rec.record_type,
      horse_id: rec.horse_id,
      horse_name: horseNameMap.get(rec.horse_id) ?? "Unknown",
      performed_by_name: rec.performed_by_name ?? rec.provider_name,
      performed_by_user_id: rec.performed_by_user_id,
      performer_display: rec.performed_by_user_id
        ? profileMap.get(rec.performed_by_user_id) ?? rec.performed_by_name ?? rec.provider_name ?? "Unknown"
        : rec.performed_by_name ?? rec.provider_name ?? "—",
      notes: params.includeNotes !== false ? rec.notes : null,
      total_cost: rec.total_cost,
      details: rec.details as Record<string, unknown> | null,
      line_items: [],
    });
  }

  // Sort by performed_at
  entries.sort((a, b) => a.performed_at.localeCompare(b.performed_at));

  // Fetch line items if enabled
  if (params.includeLineItems !== false && allEntryIds.length > 0) {
    const actIds = allEntryIds.filter((e) => e.type === "activity").map((e) => e.id);
    const healthIds = allEntryIds.filter((e) => e.type === "health").map((e) => e.id);

    const lineItemMap = new Map<string, { description: string; amount: number }[]>();

    if (actIds.length > 0) {
      const { data: actLi } = await supabase
        .from("log_entry_line_items")
        .select("*")
        .eq("log_type", "activity")
        .in("log_id", actIds)
        .order("sort_order", { ascending: true });

      for (const li of (actLi ?? []) as { log_id: string; description: string; amount: number }[]) {
        const key = `activity:${li.log_id}`;
        if (!lineItemMap.has(key)) lineItemMap.set(key, []);
        lineItemMap.get(key)!.push({ description: li.description, amount: li.amount });
      }
    }

    if (healthIds.length > 0) {
      const { data: healthLi } = await supabase
        .from("log_entry_line_items")
        .select("*")
        .eq("log_type", "health")
        .in("log_id", healthIds)
        .order("sort_order", { ascending: true });

      for (const li of (healthLi ?? []) as { log_id: string; description: string; amount: number }[]) {
        const key = `health:${li.log_id}`;
        if (!lineItemMap.has(key)) lineItemMap.set(key, []);
        lineItemMap.get(key)!.push({ description: li.description, amount: li.amount });
      }
    }

    for (const entry of entries) {
      const key = `${entry.source}:${entry.id}`;
      entry.line_items = lineItemMap.get(key) ?? [];
    }
  }

  // Compute summaries
  const totalCost = entries.reduce((sum, e) => sum + (e.total_cost ?? 0), 0);
  const uniqueHorses = new Set(entries.map((e) => e.horse_id)).size;
  const uniquePerformers = new Set(entries.map((e) => e.performer_display).filter((p) => p !== "—")).size;

  const costByType: Record<string, { count: number; total: number }> = {};
  const costByHorse: Record<string, { name: string; count: number; total: number }> = {};
  const costByPerformer: Record<string, { name: string; count: number; total: number }> = {};

  for (const e of entries) {
    // By type
    if (!costByType[e.type]) costByType[e.type] = { count: 0, total: 0 };
    costByType[e.type].count++;
    costByType[e.type].total += e.total_cost ?? 0;

    // By horse
    if (!costByHorse[e.horse_id]) costByHorse[e.horse_id] = { name: e.horse_name, count: 0, total: 0 };
    costByHorse[e.horse_id].count++;
    costByHorse[e.horse_id].total += e.total_cost ?? 0;

    // By performer
    const perfKey = e.performer_display;
    if (perfKey !== "—") {
      if (!costByPerformer[perfKey]) costByPerformer[perfKey] = { name: perfKey, count: 0, total: 0 };
      costByPerformer[perfKey].count++;
      costByPerformer[perfKey].total += e.total_cost ?? 0;
    }
  }

  const barnAddress = [barn.address, barn.city, barn.state, barn.zip].filter(Boolean).join(", ");

  return {
    entries,
    barnName: barn.name,
    barnAddress,
    generatedAt: new Date().toISOString(),
    generatedBy: profile?.full_name?.trim() || user.email || "User",
    params,
    totalCost,
    totalEntries: entries.length,
    uniqueHorses,
    uniquePerformers,
    costByType,
    costByHorse,
    costByPerformer,
  };
}

export async function saveReportHistory(
  barnId: string,
  reportType: string,
  parameters: Record<string, unknown>,
): Promise<void> {
  const supabase = await createServerComponentClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("report_history").insert({
    barn_id: barnId,
    report_type: reportType,
    parameters,
    generated_by_user_id: user.id,
  });
}

export async function getNextInvoiceNumber(barnId: string): Promise<string> {
  const supabase = await createServerComponentClient();
  const { data } = await supabase
    .from("barns")
    .select("next_invoice_number")
    .eq("id", barnId)
    .single();

  const num = (typeof data?.next_invoice_number === "number" ? data.next_invoice_number : 1) as number;
  const year = new Date().getFullYear();

  // Increment for next time
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("barns")
    .update({ next_invoice_number: num + 1 })
    .eq("id", barnId);

  return `BB-${year}-${String(num).padStart(4, "0")}`;
}

export async function getReportHistory(barnId: string) {
  const supabase = await createServerComponentClient();
  const { data } = await supabase
    .from("report_history")
    .select("*")
    .eq("barn_id", barnId)
    .order("generated_at", { ascending: false })
    .limit(10);
  return data ?? [];
}

export async function getBarnMembers(barnId: string) {
  const supabase = await createServerComponentClient();
  const { data: members } = await supabase
    .from("barn_members")
    .select("user_id, role")
    .eq("barn_id", barnId)
    .or("status.eq.active,status.is.null");

  const ids = [...new Set((members ?? []).map((m) => m.user_id))];
  if (ids.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", ids);

  const roleMap = new Map((members ?? []).map((m) => [m.user_id, m.role]));
  return (profiles ?? []).map((p) => ({
    id: p.id,
    name: p.full_name?.trim() || "Member",
    role: roleMap.get(p.id) ?? "member",
  }));
}

export async function getBarnHorses(barnId: string) {
  const supabase = await createServerComponentClient();
  const { data } = await supabase
    .from("horses")
    .select("id, name, breed, owner_name")
    .eq("barn_id", barnId)
    .eq("archived", false)
    .order("name");
  return (data ?? []) as { id: string; name: string; breed: string | null; owner_name: string | null }[];
}
