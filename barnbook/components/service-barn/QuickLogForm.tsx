"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createLogAction } from "@/app/(protected)/actions/create-log";
import { scheduleEntryAction } from "@/app/(protected)/actions/scheduled-entries";
import { LOG_TYPES, logTypeLabel, type LogType } from "@/lib/horse-form-constants";
import { ErrorDetails } from "@/components/ui/ErrorDetails";
import { FinancialsSection } from "@/components/business-pro/FinancialsSection";

/**
 * Streamlined log-entry form that opens from the Service Barn FAB.
 *
 * Reuses the canonical createLogAction; only the shape of the FormData
 * is tailored to the fast path (horse + type + date + cost + notes,
 * all else defaulted). For exercise / pony the server expects a
 * subtype; we force "walk" / no subtype respectively to keep the form
 * at 10 seconds to save.
 *
 * Photo upload is deferred — callers who need camera capture use the
 * full log form at /horses/[id]/log/[type].
 */

export interface QuickLogHorseOption {
  id: string;
  name: string;
  subtitle: string; // "at {owning barn}" for linked, location for quick
  /** Owner name for this horse — used by FinancialsSection's "Billable
   *  to owner" mode. Quick records use owner_contact_name; linked
   *  horses use the real owner_name from the horses table. */
  ownerName?: string | null;
}

interface BarnClientOption {
  id: string;
  display_name: string;
  user_id: string | null;
  name_key: string;
}

interface Props {
  serviceBarnId: string;
  horseOptions: QuickLogHorseOption[];
  onClose: () => void;
  /** Optional: pre-selected log type (FAB-level default could pass it). */
  defaultLogType?: LogType;
  /** Optional: pre-select a specific horse (per-card Log button). */
  initialHorseId?: string;
  /** When true, the FinancialsSection renders in log mode so the entry
   *  carries cost_type / billable_to / payment_status fields — which
   *  is what makes it show up in Business Pro dashboards and AR. */
  hasBusinessPro: boolean;
  /** Barn's client directory for the "Billable to client" picker. */
  barnClients: BarnClientOption[];
  /** Required so we can build the barn-members list for
   *  FinancialsSection's "Billable to member" mode. Service Barns are
   *  typically single-owner, so the only member is the current user. */
  currentUserId: string;
}

const HEALTH_TYPES = new Set<LogType>(["shoeing", "worming", "vet_visit", "dentistry"]);
const FOLLOWUP_TYPES = new Set<LogType>(["shoeing", "worming", "vet_visit", "dentistry"]);

type Mode = "log" | "schedule";
type FollowUpPreset = "none" | "6w" | "3m" | "custom";

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function QuickLogForm({
  serviceBarnId,
  horseOptions,
  onClose,
  defaultLogType,
  initialHorseId,
  hasBusinessPro,
  barnClients,
  currentUserId,
}: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [horseId, setHorseId] = useState<string>(
    initialHorseId ?? (horseOptions.length === 1 ? horseOptions[0].id : ""),
  );
  const [logType, setLogType] = useState<LogType>(
    defaultLogType ?? "exercise",
  );
  const [date, setDate] = useState<string>(todayIso());
  const [cost, setCost] = useState("");
  const [notes, setNotes] = useState("");
  const [mode, setMode] = useState<Mode>("log");
  const [followUpPreset, setFollowUpPreset] = useState<FollowUpPreset>("none");
  const [followUpCustomDate, setFollowUpCustomDate] = useState<string>("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const supportsFollowUp = mode === "log" && FOLLOWUP_TYPES.has(logType);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  /** Resolve the follow-up date from preset + custom input, or null
   *  when no follow-up was asked for / the inputs are invalid. */
  function resolveFollowUpDate(): string | null {
    if (!supportsFollowUp || followUpPreset === "none") return null;
    if (followUpPreset === "6w") return addDays(date, 42);
    if (followUpPreset === "3m") return addDays(date, 90);
    // custom
    const d = followUpCustomDate.trim();
    return d ? d : null;
  }

  function handleSave() {
    setError(null);
    if (!horseId) {
      setError("Pick a horse.");
      return;
    }

    if (mode === "schedule") {
      // Schedule path: one scheduleEntryAction call, no createLogAction.
      startTransition(async () => {
        const res = await scheduleEntryAction(horseId, logType, {
          date,
          notes: notes.trim() || undefined,
          cost: cost.trim() ? parseFloat(cost.trim()) : undefined,
        });
        if ("error" in res) {
          setError(res.error);
          return;
        }
        onClose();
        router.refresh();
      });
      return;
    }

    // Log path — existing behavior plus optional follow-up scheduling.
    startTransition(async () => {
      // If BP is active, pull FormData from the real form element so
      // FinancialsSection's hidden inputs (cost_type, billable_to_*,
      // payment_status, etc.) come through. Otherwise build FormData
      // from scratch — same behavior as before.
      const fd = hasBusinessPro && formRef.current
        ? new FormData(formRef.current)
        : new FormData();
      const isHealth = HEALTH_TYPES.has(logType);
      if (isHealth) fd.set("record_date", date);
      else fd.set("logged_at", date);

      if (cost.trim()) {
        fd.set("total_cost", cost.trim());
        // Service provider defaults: service entries are revenue — but
        // only if BP didn't emit its own cost_type (i.e., the user
        // didn't pick a type in FinancialsSection).
        if (!fd.get("cost_type")) fd.set("cost_type", "revenue");
      }
      if (notes.trim()) fd.set("notes", notes.trim());

      // Type-specific required fields (keep these minimal — the full
      // create-log flow handles rich subtypes).
      if (logType === "exercise") fd.set("subtype", "walk");
      if (logType === "breed_data") fd.set("breed_subtype", "custom");

      const res = await createLogAction(horseId, logType, fd);
      if (res.error) {
        setError(res.error);
        return;
      }

      // Follow-up: fire a second scheduleEntryAction after the main
      // log commits. A failure here shouldn't wipe the successful log,
      // so we surface it but keep the modal open for the user to deal
      // with it.
      const followUpDate = resolveFollowUpDate();
      if (followUpDate) {
        const followRes = await scheduleEntryAction(horseId, logType, {
          date: followUpDate,
        });
        if ("error" in followRes) {
          setError(
            `Log saved, but the follow-up couldn't be scheduled: ${followRes.error}`,
          );
          router.refresh();
          return;
        }
      }

      onClose();
      router.refresh();
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        background: "rgba(42,64,49,0.75)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
      className="sm:items-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="sm:my-8 sm:max-h-[92vh] sm:rounded-2xl"
        style={{
          background: "white",
          width: "100%",
          maxWidth: 520,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
        }}
      >
        <div
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid rgba(0,0,0,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div className="font-serif text-lg font-semibold text-barn-dark">
            {mode === "log" ? "Quick log" : "Schedule"}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-barn-dark/60 hover:bg-parchment"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* The body is a real <form> element so FinancialsSection's
            hidden inputs participate in FormData(form) on submit. The
            Save button outside the form calls handleSave directly, so
            no onSubmit handler is wired — Enter in inputs is a no-op
            by design. */}
        <form
          ref={formRef}
          onSubmit={(e) => e.preventDefault()}
          style={{ flex: 1, overflow: "auto", padding: 16 }}
          className="space-y-3"
        >
          {/* Mode toggle: Log entry vs Schedule. A segmented control is
              cheap to build with two buttons and zero added deps. */}
          <div
            role="tablist"
            aria-label="Entry mode"
            className="inline-flex rounded-xl border p-0.5"
            style={{ borderColor: "rgba(42,64,49,0.15)", background: "rgba(42,64,49,0.04)" }}
          >
            {(["log", "schedule"] as const).map((m) => {
              const active = mode === m;
              return (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setMode(m)}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold"
                  style={{
                    background: active ? "#c9a84c" : "transparent",
                    color: active ? "#2a4031" : "rgba(42,64,49,0.7)",
                  }}
                >
                  {m === "log" ? "Log entry" : "Schedule"}
                </button>
              );
            })}
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-barn-dark/80">
              Horse
            </span>
            <select
              value={horseId}
              onChange={(e) => setHorseId(e.target.value)}
              className="w-full rounded-xl border px-4 py-3 outline-none"
              style={{
                borderColor: "rgba(42,64,49,0.15)",
                color: "#2a4031",
                background: "white",
              }}
            >
              <option value="">Pick a horse…</option>
              {horseOptions.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} — {h.subtitle}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-barn-dark/80">
              Type
            </span>
            <select
              value={logType}
              onChange={(e) => setLogType(e.target.value as LogType)}
              className="w-full rounded-xl border px-4 py-3 outline-none"
              style={{
                borderColor: "rgba(42,64,49,0.15)",
                color: "#2a4031",
                background: "white",
              }}
            >
              {LOG_TYPES.map((t) => (
                <option key={t} value={t}>
                  {logTypeLabel(t)}
                </option>
              ))}
            </select>
          </label>

          <div className={mode === "log" ? "grid gap-3 grid-cols-2" : ""}>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-barn-dark/80">
                Date
              </span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min={mode === "schedule" ? todayIso() : undefined}
                className="w-full rounded-xl border px-4 py-3 outline-none"
                style={{
                  borderColor: "rgba(42,64,49,0.15)",
                  color: "#2a4031",
                  background: "white",
                }}
              />
              {mode === "log" && (
                <span className="mt-1 block text-[11px] text-barn-dark/55">
                  Tap to set a past date for historical entries.
                </span>
              )}
            </label>
            {mode === "log" && (
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-barn-dark/80">
                  Cost (optional)
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  placeholder="$"
                  className="w-full rounded-xl border px-4 py-3 outline-none"
                  style={{
                    borderColor: "rgba(42,64,49,0.15)",
                    color: "#2a4031",
                    background: "white",
                  }}
                />
              </label>
            )}
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-barn-dark/80">
              Notes (optional)
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-xl border px-4 py-3 outline-none"
              style={{
                borderColor: "rgba(42,64,49,0.15)",
                color: "#2a4031",
                background: "white",
              }}
            />
          </label>

          {/* Follow-up — only for log-mode on types that have a
              natural "next time" cadence. Creates a second, planned
              entry after the main log insert. */}
          {supportsFollowUp && (
            <details
              className="rounded-xl border px-3 py-2"
              style={{
                borderColor: "rgba(42,64,49,0.12)",
                background: "rgba(42,64,49,0.03)",
              }}
            >
              <summary
                className="cursor-pointer text-sm font-medium text-barn-dark/85"
                style={{ listStyle: "none" }}
              >
                Schedule follow-up?
              </summary>
              <div className="mt-2 space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      { key: "none", label: "No follow-up" },
                      { key: "6w", label: "6 weeks" },
                      { key: "3m", label: "3 months" },
                      { key: "custom", label: "Custom" },
                    ] as const
                  ).map((opt) => {
                    const active = followUpPreset === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setFollowUpPreset(opt.key)}
                        aria-pressed={active}
                        className="rounded-full border px-2.5 py-1 text-xs font-medium"
                        style={{
                          borderColor: active ? "#c9a84c" : "rgba(42,64,49,0.15)",
                          background: active ? "rgba(201,168,76,0.15)" : "white",
                          color: "#2a4031",
                        }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                {followUpPreset === "custom" && (
                  <input
                    type="date"
                    value={followUpCustomDate}
                    onChange={(e) => setFollowUpCustomDate(e.target.value)}
                    min={todayIso()}
                    className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none"
                    style={{
                      borderColor: "rgba(42,64,49,0.15)",
                      color: "#2a4031",
                      background: "white",
                    }}
                  />
                )}
                {followUpPreset !== "none" && (
                  <div className="text-[11px] text-barn-dark/55">
                    Creates a planned entry for the same horse and type.
                  </div>
                )}
              </div>
            </details>
          )}

          {/* Business Pro financials — same component as the full log
              form at /horses/[id]/log/[type]. It renders hidden inputs
              (cost_type / billable_to_* / payment_status / paid_*)
              that are captured when handleSave reads FormData from
              this <form>. Only shown in log mode when the user has BP. */}
          {mode === "log" && hasBusinessPro && (
            <FinancialsSection
              logType={logType}
              totalCost={cost.trim() ? parseFloat(cost.trim()) || 0 : 0}
              barnMembers={[{ id: currentUserId, name: "Me", role: "owner" }]}
              clients={barnClients}
              horseOwnerName={
                horseOptions.find((h) => h.id === horseId)?.ownerName ?? null
              }
            />
          )}

          {error && (
            <ErrorDetails
              title="Couldn't save"
              message={error}
              extra={{ ServiceBarn: serviceBarnId, Horse: horseId, Type: logType }}
            />
          )}
        </form>

        <div
          style={{
            padding: "12px 16px",
            borderTop: "1px solid rgba(0,0,0,0.08)",
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-xl border px-4 py-2 text-sm font-medium text-barn-dark hover:bg-parchment disabled:opacity-50"
            style={{ borderColor: "rgba(42,64,49,0.15)" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={pending || !horseId}
            className="rounded-xl px-5 py-2 text-sm font-semibold shadow disabled:opacity-60"
            style={{ background: "#c9a84c", color: "#2a4031" }}
          >
            {pending
              ? mode === "schedule"
                ? "Scheduling…"
                : "Saving…"
              : mode === "schedule"
                ? "Schedule"
                : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
