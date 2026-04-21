"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createLogAction } from "@/app/(protected)/actions/create-log";
import { LOG_TYPES, logTypeLabel, type LogType } from "@/lib/horse-form-constants";
import { ErrorDetails } from "@/components/ui/ErrorDetails";

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
}

interface Props {
  serviceBarnId: string;
  horseOptions: QuickLogHorseOption[];
  onClose: () => void;
  /** Optional: pre-selected log type (FAB-level default could pass it). */
  defaultLogType?: LogType;
}

const HEALTH_TYPES = new Set<LogType>(["shoeing", "worming", "vet_visit"]);

export function QuickLogForm({
  serviceBarnId,
  horseOptions,
  onClose,
  defaultLogType,
}: Props) {
  const router = useRouter();
  const [horseId, setHorseId] = useState<string>(
    horseOptions.length === 1 ? horseOptions[0].id : "",
  );
  const [logType, setLogType] = useState<LogType>(
    defaultLogType ?? "exercise",
  );
  const [date, setDate] = useState<string>(todayIso());
  const [cost, setCost] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleSave() {
    setError(null);
    if (!horseId) {
      setError("Pick a horse.");
      return;
    }
    startTransition(async () => {
      const fd = new FormData();
      const isHealth = HEALTH_TYPES.has(logType);
      if (isHealth) fd.set("record_date", date);
      else fd.set("logged_at", date);

      if (cost.trim()) {
        fd.set("total_cost", cost.trim());
        // Service provider defaults: service entries are revenue.
        fd.set("cost_type", "revenue");
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
            Quick log
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

        <div style={{ flex: 1, overflow: "auto", padding: 16 }} className="space-y-3">
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

          <div className="grid gap-3 grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-barn-dark/80">
                Date
              </span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border px-4 py-3 outline-none"
                style={{
                  borderColor: "rgba(42,64,49,0.15)",
                  color: "#2a4031",
                  background: "white",
                }}
              />
            </label>
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

          {error && (
            <ErrorDetails
              title="Couldn't save"
              message={error}
              extra={{ ServiceBarn: serviceBarnId, Horse: horseId, Type: logType }}
            />
          )}
        </div>

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
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
