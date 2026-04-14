"use client";

import { updateHorseAction, deleteHorseAction } from "@/app/(protected)/actions/horse";
import { deleteLogAction } from "@/app/(protected)/actions/delete-log";
import { moveHorseAction } from "@/app/(protected)/actions/move-horse";
import type { FoalOriginData } from "@/components/embryo/FoalOriginTimeline";
import { ActivityEntry } from "@/components/ActivityEntry";
import { CareCard } from "@/components/CareCard";
import { HealthRecordItem } from "@/components/HealthRecord";
import { HorsePhoto } from "@/components/HorsePhoto";
import { LogDetailModal } from "@/components/LogDetailModal";
import { LogFilters } from "@/components/LogFilters";
import { Button, linkButtonClass } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { HORSE_BREEDS, HORSE_SEX_OPTIONS, BREEDING_ROLES, BREEDING_ROLE_LABELS } from "@/lib/horse-form-constants";
import { uploadHorseProfilePhoto } from "@/lib/horse-photo";
import { LogSummaryBar } from "@/components/LogSummaryBar";
import type { ActivityLog, Flush, HealthRecord, Horse, HorseStay, LogMedia, LogEntryLineItem, Pregnancy } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";

const baseTabItems = [
  { id: "overview", label: "Overview" },
  { id: "logs", label: "Logs" },
  { id: "access", label: "Access" },
] as const;

type TabId = "overview" | "logs" | "access";

const ALL_LOG_TYPES = [
  { value: "exercise", label: "Exercise" },
  { value: "feed", label: "Feed" },
  { value: "medication", label: "Medication" },
  { value: "note", label: "Note" },
  { value: "breed_data", label: "Breed Data" },
  { value: "shoeing", label: "Shoeing" },
  { value: "worming", label: "Worming" },
  { value: "vet_visit", label: "Vet Visit" },
] as const;

export function HorseProfileClient({
  horse,
  canEdit,
  initialTab,
  activities,
  healthRows,
  accessRows,
  profileUrl,
  qrSrc,
  listError,
  lastShoeing,
  lastWorming,
  activeStay,
  logMedia,
  lineItems,
  userNames,
  barnNames,
  allBarns,
  prevHorse,
  nextHorse,
  barnStallions,
  donorFlushes,
  donorPregnancies,
  surrogatePregnancies,
  stallionFlushes,
  stallionPregnancies,
  breedingHorseNames,
  foalOriginData,
}: {
  horse: Horse;
  canEdit: boolean;
  initialTab: string;
  activities: ActivityLog[];
  healthRows: HealthRecord[];
  accessRows: { label: string; sub: string; kind: string }[];
  profileUrl: string;
  qrSrc: string;
  listError?: string;
  lastShoeing?: HealthRecord | null;
  lastWorming?: HealthRecord | null;
  activeStay?: HorseStay | null;
  logMedia?: LogMedia[];
  lineItems?: LogEntryLineItem[];
  userNames?: Record<string, string>;
  barnNames?: Record<string, string>;
  allBarns?: { id: string; name: string }[];
  prevHorse?: { id: string; name: string } | null;
  nextHorse?: { id: string; name: string } | null;
  barnStallions?: { id: string; name: string }[];
  donorFlushes?: Flush[];
  donorPregnancies?: Pregnancy[];
  surrogatePregnancies?: Pregnancy[];
  stallionFlushes?: Flush[];
  stallionPregnancies?: Pregnancy[];
  breedingHorseNames?: Record<string, string>;
  foalOriginData?: FoalOriginData | null;
}) {
  const router = useRouter();
  const { show } = useToast();
  const searchParams = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedLog, setSelectedLog] = useState<{
    kind: "activity" | "health";
    entry: ActivityLog | HealthRecord;
  } | null>(null);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showFlushModal, setShowFlushModal] = useState(false);
  const [moving, setMoving] = useState(false);
  const [logTypeFilter, setLogTypeFilter] = useState<string | null>(null);
  const [logDateRange, setLogDateRange] = useState("all");
  const [showAddLogDropdown, setShowAddLogDropdown] = useState(false);
  const [showHeaderLogDropdown, setShowHeaderLogDropdown] = useState(false);
  const [confirmingDeleteHorse, setConfirmingDeleteHorse] = useState(false);
  const [deletingHorse, setDeletingHorse] = useState(false);

  const tabItems = baseTabItems;

  const tabParam = searchParams.get("tab");
  const tab: TabId = ((): TabId => {
    const raw = tabParam ?? initialTab;
    // Remap old tabs to "logs"
    if (raw === "activity" || raw === "health") return "logs";
    if (raw === "overview" || raw === "logs" || raw === "access") return raw as TabId;
    return "overview";
  })();

  const setTab = useCallback(
    (next: string) => {
      const id = next as TabId;
      router.replace(`/horses/${horse.id}?tab=${id}`, { scroll: false });
    },
    [horse.id, router],
  );

  async function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !canEdit) return;
    const up = await uploadHorseProfilePhoto(horse.id, file);
    if ("error" in up) {
      show("We couldn't upload that photo. Try a smaller JPG or PNG.", "error");
      return;
    }
    const { error } = await supabase
      .from("horses")
      .update({ photo_url: up.publicUrl, updated_at: new Date().toISOString() })
      .eq("id", horse.id);
    if (error) {
      show("We couldn't save the photo. Please try again.", "error");
      return;
    }
    show("Photo updated.", "success");
    router.refresh();
  }

  async function handleSave() {
    if (!formRef.current) return;
    setSaving(true);
    const formData = new FormData(formRef.current);
    const result = await updateHorseAction(horse.id, formData);
    setSaving(false);
    if (result?.error) {
      show(result.error, "error");
    } else {
      show("Horse updated.", "success");
      setEditing(false);
      router.refresh();
    }
  }

  function handleCancel() {
    formRef.current?.reset();
    setEditing(false);
    setConfirmingDeleteHorse(false);
  }

  async function handleDeleteHorse() {
    setDeletingHorse(true);
    const result = await deleteHorseAction(horse.id);
    if (result?.error) {
      show(result.error, "error");
      setDeletingHorse(false);
      setConfirmingDeleteHorse(false);
    } else {
      show(`${horse.name} has been deleted.`, "success");
      router.push("/horses");
    }
  }

  async function handleMove(targetBarnId: string) {
    setMoving(true);
    const result = await moveHorseAction(horse.id, targetBarnId);
    setMoving(false);
    if (result?.error) {
      show(result.error, "error");
    } else {
      show("Horse moved successfully.", "success");
      setShowMoveModal(false);
      router.refresh();
    }
  }

  const otherBarns = useMemo(
    () => (allBarns ?? []).filter((b) => b.id !== horse.barn_id),
    [allBarns, horse.barn_id],
  );

  const filterByDate = useCallback((date: string, range: string) => {
    if (range === "all") return true;
    const d = new Date(date);
    const now = new Date();
    if (range === "week") {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return d >= weekAgo;
    }
    if (range === "month") {
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }
    if (range === "year") {
      return d.getFullYear() === now.getFullYear();
    }
    return true;
  }, []);

  // Unified log entries: merge activities + health, sorted by date desc
  type UnifiedLog =
    | { kind: "activity"; entry: ActivityLog; date: string; type: string }
    | { kind: "health"; entry: HealthRecord; date: string; type: string };

  const allLogs = useMemo(() => {
    const logs: UnifiedLog[] = [
      ...activities.map((a) => ({
        kind: "activity" as const,
        entry: a,
        date: a.performed_at ?? a.created_at,
        type: a.activity_type,
      })),
      ...healthRows.map((h) => ({
        kind: "health" as const,
        entry: h,
        date: h.performed_at ?? h.record_date,
        type: h.record_type?.toLowerCase().replace(" ", "_") ?? "unknown",
      })),
    ];
    logs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return logs;
  }, [activities, healthRows]);

  const allLogTypes = useMemo(
    () => [...new Set(allLogs.map((l) => l.type))],
    [allLogs],
  );

  // Count log types for sorting the "Add Log" dropdown by most used
  const logTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const l of allLogs) {
      counts[l.type] = (counts[l.type] ?? 0) + 1;
    }
    return counts;
  }, [allLogs]);

  const sortedLogTypes = useMemo(
    () =>
      [...ALL_LOG_TYPES].sort(
        (a, b) => (logTypeCounts[b.value] ?? 0) - (logTypeCounts[a.value] ?? 0),
      ),
    [logTypeCounts],
  );

  const filteredLogs = useMemo(
    () =>
      allLogs.filter((l) => {
        if (logTypeFilter && l.type !== logTypeFilter) return false;
        return filterByDate(l.date, logDateRange);
      }),
    [allLogs, logTypeFilter, logDateRange, filterByDate],
  );

  const getMediaForLog = useCallback(
    (logType: "activity" | "health", logId: string) =>
      (logMedia ?? []).filter((m) => m.log_type === logType && m.log_id === logId),
    [logMedia],
  );

  const getLineItemsForLog = useCallback(
    (logType: "activity" | "health", logId: string) =>
      (lineItems ?? []).filter((li) => li.log_type === logType && li.log_id === logId),
    [lineItems],
  );

  const getPerformerInfo = useCallback(
    (entry: ActivityLog | HealthRecord) => {
      if (entry.performed_by_name) return { name: entry.performed_by_name, role: null };
      if (entry.performed_by_user_id && userNames?.[entry.performed_by_user_id]) {
        return { name: userNames[entry.performed_by_user_id], role: null };
      }
      return { name: null, role: null };
    },
    [userNames],
  );

  // Summary stats for filtered logs
  const logSummary = useMemo(() => {
    const totalCost = filteredLogs.reduce((s, l) => s + (l.entry.total_cost ?? 0), 0);
    const dates = filteredLogs.map((l) => l.date).filter(Boolean).sort();
    return {
      count: filteredLogs.length,
      totalCost: totalCost > 0 ? totalCost : null,
      dateRange: dates.length > 0 ? { earliest: dates[0], latest: dates[dates.length - 1] } : null,
    };
  }, [filteredLogs]);

  /** Fields are disabled unless user has permission AND is in edit mode */
  const fieldsDisabled = !editing;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <div className="flex items-center justify-between">
        <Link href="/horses" className="text-sm text-barn-dark/70 hover:text-brass-gold">
          ← Horses
        </Link>
        <div className="flex items-center gap-1">
          {prevHorse ? (
            <Link
              href={`/horses/${prevHorse.id}`}
              className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-barn-dark/60 hover:bg-barn-dark/5 hover:text-barn-dark transition"
              title={prevHorse.name}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
              <span className="hidden sm:inline max-w-[80px] truncate">{prevHorse.name}</span>
            </Link>
          ) : (
            <span className="w-8" />
          )}
          {nextHorse ? (
            <Link
              href={`/horses/${nextHorse.id}`}
              className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-barn-dark/60 hover:bg-barn-dark/5 hover:text-barn-dark transition"
              title={nextHorse.name}
            >
              <span className="hidden sm:inline max-w-[80px] truncate">{nextHorse.name}</span>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </Link>
          ) : (
            <span className="w-8" />
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-barn-dark">{horse.name}</h1>
          <p className="text-sm text-barn-dark/55">{horse.breed ?? "Horse"}</p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && !editing ? (
            <div className="flex items-center gap-2">
              {/* New Log button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowHeaderLogDropdown(!showHeaderLogDropdown)}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-forest-green bg-forest-green px-4 py-2.5 text-sm font-medium text-white shadow hover:brightness-110 transition-all"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  New Log
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
                {showHeaderLogDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowHeaderLogDropdown(false)} />
                    <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-xl border border-barn-dark/10 bg-white py-1 shadow-lg">
                      {sortedLogTypes.map((lt) => (
                        <Link
                          key={lt.value}
                          href={`/horses/${horse.id}/log/${lt.value}`}
                          className="flex items-center justify-between px-4 py-2.5 text-sm text-barn-dark hover:bg-parchment transition"
                          onClick={() => setShowHeaderLogDropdown(false)}
                        >
                          <span>{lt.label}</span>
                          {(logTypeCounts[lt.value] ?? 0) > 0 && (
                            <span className="text-xs text-barn-dark/30">{logTypeCounts[lt.value]}</span>
                          )}
                        </Link>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-brass-gold bg-brass-gold px-4 py-2.5 text-sm font-medium text-barn-dark shadow hover:brightness-110 transition-all"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                Edit Horse
              </button>
              {otherBarns.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setShowMoveModal(true)}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-barn-dark/20 bg-white px-4 py-2.5 text-sm font-medium text-barn-dark shadow hover:border-brass-gold transition-all"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  Move
                </button>
              ) : null}
            </div>
          ) : null}
          <Badge variant="pending">Biometric ID — coming soon</Badge>
        </div>
      </div>

      {listError ? (
        <p className="mt-4 rounded-lg border border-barn-red/40 bg-barn-red/10 px-3 py-2 text-sm text-barn-dark">
          {listError === "no_permission"
            ? "You don't have permission for that action."
            : (() => {
                try {
                  return decodeURIComponent(listError);
                } catch {
                  return "Something went wrong.";
                }
              })()}
        </p>
      ) : null}

      {/* Active stay indicator */}
      {activeStay ? (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-brass-gold/30 bg-brass-gold/10 px-4 py-2.5">
          <svg className="h-4 w-4 text-brass-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          <p className="text-sm text-barn-dark">
            Currently at{" "}
            <span className="font-medium">
              {barnNames?.[activeStay.host_barn_id] ?? "Mare Motel"}
            </span>
          </p>
        </div>
      ) : null}

      {/* Public Care Summary */}
      <div className="mt-5">
        <CareCard horse={horse} lastShoeing={lastShoeing} lastWorming={lastWorming} />
      </div>

      <div className="mt-6">
        <Tabs items={[...tabItems]} value={tab} onValueChange={setTab} />
      </div>

      <div className="rounded-b-2xl border border-t-0 border-barn-dark/10 bg-white p-5 shadow-sm sm:p-8">
        {tab === "overview" ? (
          <div className="space-y-8">
            <div className="flex flex-col gap-6 lg:flex-row">
              <div className="shrink-0">
                <div className="w-full max-w-sm overflow-hidden rounded-2xl">
                  <HorsePhoto
                    name={horse.name}
                    photoUrl={horse.photo_url}
                    className="rounded-2xl"
                    aspectClassName="aspect-[4/3] w-full"
                  />
                </div>
                {canEdit && editing ? (
                  <label className="mt-3 inline-block cursor-pointer text-sm font-medium text-brass-gold hover:underline">
                    Change photo
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      onChange={onPhotoChange}
                    />
                  </label>
                ) : null}
              </div>

              <form ref={formRef} className="min-w-0 flex-1 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input label="Name" name="name" defaultValue={horse.name} disabled={fieldsDisabled} required />
                  <Input label="Barn name" name="barn_name" defaultValue={horse.barn_name ?? ""} disabled={fieldsDisabled} />
                  <Select label="Breed" name="breed" defaultValue={horse.breed ?? ""} disabled={fieldsDisabled}>
                    <option value="">—</option>
                    {HORSE_BREEDS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </Select>
                  <Select label="Sex" name="sex" defaultValue={horse.sex ?? ""} disabled={fieldsDisabled}>
                    <option value="">—</option>
                    {HORSE_SEX_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                  <Input label="Color" name="color" defaultValue={horse.color ?? ""} disabled={fieldsDisabled} />
                  <Input
                    label="Foal date"
                    name="foal_date"
                    type="date"
                    defaultValue={horse.foal_date?.slice(0, 10) ?? ""}
                    disabled={fieldsDisabled}
                  />
                  <Input label="Owner" name="owner_name" defaultValue={horse.owner_name ?? ""} disabled={fieldsDisabled} />
                  <Input label="Sire" name="sire" defaultValue={horse.sire ?? ""} disabled={fieldsDisabled} />
                  <Input label="Dam" name="dam" defaultValue={horse.dam ?? ""} disabled={fieldsDisabled} />
                  <Input
                    label="Registration #"
                    name="registration_number"
                    defaultValue={horse.registration_number ?? ""}
                    disabled={fieldsDisabled}
                  />
                  <Input
                    label="Microchip"
                    name="microchip_number"
                    defaultValue={horse.microchip_number ?? ""}
                    disabled={fieldsDisabled}
                  />
                  <Select label="Breeding Role" name="breeding_role" defaultValue={horse.breeding_role ?? "none"} disabled={fieldsDisabled}>
                    {BREEDING_ROLES.map((r) => (
                      <option key={r} value={r}>{BREEDING_ROLE_LABELS[r]}</option>
                    ))}
                  </Select>
                </div>

                {/* Care info — publicly visible via care card & QR code */}
                <div className="border-t border-barn-dark/10 pt-4">
                  <h3 className="mb-3 text-sm font-semibold text-barn-dark/70">
                    Care info
                    <span className="ml-2 text-xs font-normal text-barn-dark/40">
                      (visible on public care card)
                    </span>
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-sm font-medium text-barn-dark/70">
                        Feed regimen
                      </label>
                      <textarea
                        name="feed_regimen"
                        rows={2}
                        defaultValue={horse.feed_regimen ?? ""}
                        disabled={fieldsDisabled}
                        placeholder="e.g. 2 flakes timothy AM/PM, 1 scoop Strategy"
                        className="w-full rounded-xl border border-barn-dark/15 bg-white px-4 py-3 text-sm text-barn-dark placeholder:text-barn-dark/30 focus:border-brass-gold focus:ring-brass-gold/25 focus:outline-none disabled:opacity-60"
                      />
                    </div>
                    <Input
                      label="Supplements"
                      name="supplements"
                      defaultValue={horse.supplements ?? ""}
                      disabled={fieldsDisabled}
                      placeholder="e.g. SmartPak joint support daily"
                    />
                    <Input
                      label="Turnout schedule"
                      name="turnout_schedule"
                      defaultValue={horse.turnout_schedule ?? ""}
                      disabled={fieldsDisabled}
                      placeholder="e.g. AM turnout 7a-12p, PM stall"
                    />
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-sm font-medium text-barn-dark/70">
                        Special care notes
                      </label>
                      <textarea
                        name="special_care_notes"
                        rows={2}
                        defaultValue={horse.special_care_notes ?? ""}
                        disabled={fieldsDisabled}
                        placeholder="e.g. Easy keeper — no grain. Muzzle on turnout."
                        className="w-full rounded-xl border border-barn-dark/15 bg-white px-4 py-3 text-sm text-barn-dark placeholder:text-barn-dark/30 focus:border-brass-gold focus:ring-brass-gold/25 focus:outline-none disabled:opacity-60"
                      />
                    </div>
                  </div>
                </div>

                {/* Save / Cancel / Delete buttons — only in edit mode */}
                {editing ? (
                  <div className="flex flex-col gap-4 pt-2">
                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        onClick={handleSave}
                        disabled={saving || deletingHorse}
                      >
                        {saving ? "Saving…" : "Save changes"}
                      </Button>
                      <button
                        type="button"
                        onClick={handleCancel}
                        disabled={saving || deletingHorse}
                        className="inline-flex min-h-[44px] items-center rounded-xl border border-barn-dark/20 bg-white px-4 py-2.5 text-sm font-medium text-barn-dark hover:border-brass-gold disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>

                    {/* Delete horse */}
                    <div className="border-t border-barn-dark/10 pt-4">
                      {!confirmingDeleteHorse ? (
                        <button
                          type="button"
                          onClick={() => setConfirmingDeleteHorse(true)}
                          disabled={saving || deletingHorse}
                          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-red-300 bg-white px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition-all"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Delete Horse
                        </button>
                      ) : (
                        <div className="rounded-xl border border-red-300 bg-red-50 p-4">
                          <p className="text-sm font-medium text-red-800">
                            Are you sure you want to delete <strong>{horse.name}</strong>? This will permanently remove all logs, health records, and photos. This cannot be undone.
                          </p>
                          <div className="mt-3 flex items-center gap-3">
                            <button
                              type="button"
                              onClick={handleDeleteHorse}
                              disabled={deletingHorse}
                              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-all"
                            >
                              {deletingHorse ? "Deleting…" : "Yes, delete forever"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmingDeleteHorse(false)}
                              disabled={deletingHorse}
                              className="inline-flex min-h-[44px] items-center rounded-xl border border-barn-dark/20 bg-white px-4 py-2.5 text-sm font-medium text-barn-dark hover:border-brass-gold disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </form>
            </div>

            <section className="border-t border-barn-dark/10 pt-8">
              <h2 className="font-serif text-lg text-barn-dark">QR code</h2>
              <p className="mt-1 text-sm text-barn-dark/65">
                Scan to open this horse&apos;s public care card (no sign-in required).
              </p>
              <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="rounded-xl border border-barn-dark/10 bg-parchment p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrSrc} alt="" width={220} height={220} className="h-auto w-[200px]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="break-all text-sm text-barn-dark/80">{profileUrl}</p>
                  <p className="mt-2 font-mono text-xs text-barn-dark/50">QR: {horse.qr_code}</p>
                </div>
              </div>
            </section>
          </div>
        ) : null}

        {tab === "logs" ? (
          <div className="space-y-4">
            {/* Add Log button + dropdown */}
            {canEdit ? (
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-barn-dark">
                  {allLogs.length} {allLogs.length === 1 ? "entry" : "entries"}
                </h3>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowAddLogDropdown(!showAddLogDropdown)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-brass-gold px-4 py-2 text-sm font-medium text-barn-dark shadow hover:brightness-110 transition"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    Add Log
                    <svg className="h-3 w-3 ml-1" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>
                  {showAddLogDropdown && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowAddLogDropdown(false)} />
                      <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-xl border border-barn-dark/10 bg-white py-1 shadow-lg">
                        {sortedLogTypes.map((lt) => (
                          <Link
                            key={lt.value}
                            href={`/horses/${horse.id}/log/${lt.value}`}
                            className="flex items-center justify-between px-4 py-2.5 text-sm text-barn-dark hover:bg-parchment transition"
                            onClick={() => setShowAddLogDropdown(false)}
                          >
                            <span>{lt.label}</span>
                            {(logTypeCounts[lt.value] ?? 0) > 0 && (
                              <span className="text-xs text-barn-dark/30">{logTypeCounts[lt.value]}</span>
                            )}
                          </Link>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : null}

            {/* Filters */}
            {allLogs.length > 0 ? (
              <LogFilters
                types={allLogTypes}
                selectedType={logTypeFilter}
                onTypeChange={setLogTypeFilter}
                dateRange={logDateRange}
                onDateRangeChange={setLogDateRange}
              />
            ) : null}

            {/* Summary bar */}
            <LogSummaryBar
              entryCount={logSummary.count}
              totalCost={logSummary.totalCost}
              dateRange={logSummary.dateRange}
            />

            {/* Unified log list */}
            <ul className="divide-y divide-barn-dark/10">
              {filteredLogs.length === 0 ? (
                <li className="py-4 text-barn-dark/60">
                  {allLogs.length === 0 ? "No log entries yet." : "No entries match your filters."}
                </li>
              ) : (
                filteredLogs.map((l) =>
                  l.kind === "activity" ? (
                    <ActivityEntry
                      key={`a-${l.entry.id}`}
                      activity={l.entry}
                      loggerName={l.entry.logged_by ? (userNames?.[l.entry.logged_by] ?? null) : null}
                      loggerBarn={l.entry.logged_at_barn_id ? (barnNames?.[l.entry.logged_at_barn_id] ?? null) : null}
                      onClick={() => setSelectedLog({ kind: "activity", entry: l.entry })}
                    />
                  ) : (
                    <HealthRecordItem
                      key={`h-${l.entry.id}`}
                      record={l.entry}
                      loggerName={l.entry.logged_by ? (userNames?.[l.entry.logged_by] ?? null) : null}
                      loggerBarn={l.entry.logged_at_barn_id ? (barnNames?.[l.entry.logged_at_barn_id] ?? null) : null}
                      onClick={() => setSelectedLog({ kind: "health", entry: l.entry })}
                    />
                  ),
                )
              )}
            </ul>
          </div>
        ) : null}


        {tab === "access" ? (
          <div className="space-y-6">
            <p className="text-sm text-barn-dark/70">
              People who can see this horse through your barn team or a stall key.
            </p>
            <ul className="divide-y divide-barn-dark/10">
              {accessRows.map((row, i) => (
                <li key={`${row.label}-${row.sub}-${i}`} className="flex justify-between py-3">
                  <div>
                    <p className="font-medium text-barn-dark">{row.label}</p>
                    <p className="text-xs text-barn-dark/50">{row.kind}</p>
                  </div>
                  <span className="text-sm capitalize text-barn-dark/65">{row.sub}</span>
                </li>
              ))}
            </ul>
            {canEdit ? (
              <Link href={`/keys/generate?type=stall&horse=${horse.id}`} className={linkButtonClass("primary")}>
                Generate Stall Key
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Move horse modal */}
      {showMoveModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowMoveModal(false)}>
          <div className="fixed inset-0 bg-black/40" />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-serif text-lg font-semibold text-barn-dark">Move {horse.name}</h3>
            <p className="mt-1 text-sm text-barn-dark/60">Select which barn to move this horse to.</p>
            <ul className="mt-4 space-y-2">
              {otherBarns.map((barn) => (
                <li key={barn.id}>
                  <button
                    type="button"
                    disabled={moving}
                    onClick={() => handleMove(barn.id)}
                    className="flex w-full items-center justify-between rounded-xl border border-barn-dark/15 bg-parchment/50 px-4 py-3 text-left text-sm font-medium text-barn-dark transition hover:border-brass-gold hover:bg-brass-gold/10 disabled:opacity-50"
                  >
                    <span>{barn.name}</span>
                    <svg className="h-4 w-4 text-barn-dark/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setShowMoveModal(false)}
              className="mt-4 w-full rounded-xl border border-barn-dark/20 bg-white px-4 py-2.5 text-sm font-medium text-barn-dark hover:border-brass-gold"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}


      {/* Log detail modal */}
      {selectedLog ? (
        <LogDetailModal
          item={
            selectedLog.kind === "activity"
              ? { kind: "activity", entry: selectedLog.entry as ActivityLog }
              : { kind: "health", entry: selectedLog.entry as HealthRecord }
          }
          media={getMediaForLog(selectedLog.kind, selectedLog.entry.id)}
          lineItems={getLineItemsForLog(selectedLog.kind, selectedLog.entry.id)}
          performerName={getPerformerInfo(selectedLog.entry).name}
          performerRole={getPerformerInfo(selectedLog.entry).role}
          loggerName={
            selectedLog.kind === "activity"
              ? ((selectedLog.entry as ActivityLog).logged_by
                  ? userNames?.[(selectedLog.entry as ActivityLog).logged_by!] ?? null
                  : null)
              : ((selectedLog.entry as HealthRecord).logged_by
                  ? userNames?.[(selectedLog.entry as HealthRecord).logged_by!] ?? null
                  : null)
          }
          loggerBarn={
            selectedLog.kind === "activity"
              ? ((selectedLog.entry as ActivityLog).logged_at_barn_id
                  ? barnNames?.[(selectedLog.entry as ActivityLog).logged_at_barn_id!] ?? null
                  : null)
              : ((selectedLog.entry as HealthRecord).logged_at_barn_id
                  ? barnNames?.[(selectedLog.entry as HealthRecord).logged_at_barn_id!] ?? null
                  : null)
          }
          onClose={() => setSelectedLog(null)}
          canEdit={canEdit}
          canDelete={canEdit}
          horseId={horse.id}
          onDelete={async () => {
            const logType = selectedLog.kind === "activity" ? "activity" as const : "health" as const;
            const result = await deleteLogAction(selectedLog.entry.id, logType, horse.id);
            if (result.error) {
              show(result.error, "error");
            } else {
              show("Log entry deleted.", "success");
              setSelectedLog(null);
              router.refresh();
            }
          }}
        />
      ) : null}
    </div>
  );
}
