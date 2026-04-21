"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  cancelScheduledEntryAction,
  markEntryCompletedAction,
  rescheduleEntryAction,
} from "@/app/(protected)/actions/scheduled-entries";
import { logTypeLabel } from "@/lib/horse-form-constants";
import type { UpcomingEntry } from "./UpcomingStrip";

/**
 * One row inside the dashboard Upcoming strip. Actions: mark done,
 * reschedule (inline date picker), cancel. Overdue rows (date < now)
 * get a red "Overdue" badge but stay visible — we never silently
 * advance or delete planned entries.
 */
export function UpcomingRow({ entry }: { entry: UpcomingEntry }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [editingDate, setEditingDate] = useState(false);
  const [newDate, setNewDate] = useState<string>(entry.date.slice(0, 10));
  const [completing, setCompleting] = useState(false);
  const [doneCost, setDoneCost] = useState("");
  const [doneNotes, setDoneNotes] = useState("");

  const entryDate = new Date(entry.date);
  // Snapshot "now" once per mount — react-hooks/purity would flag
  // Date.now() directly in render because it's non-deterministic.
  const [nowMs] = useState(() => Date.now());
  const isOverdue = entryDate.getTime() < nowMs - 24 * 60 * 60 * 1000;

  function submitDone(options?: { skipFields?: boolean }) {
    setErr(null);
    const costRaw = doneCost.trim();
    const parsedCost = costRaw ? parseFloat(costRaw) : null;
    const costToSend = options?.skipFields
      ? undefined
      : costRaw
        ? Number.isNaN(parsedCost as number)
          ? undefined
          : parsedCost
        : undefined;
    const notesToSend = options?.skipFields
      ? undefined
      : doneNotes.trim() || undefined;

    startTransition(async () => {
      const res = await markEntryCompletedAction(entry.id, entry.kind, {
        cost: costToSend,
        notes: notesToSend,
      });
      if ("error" in res) {
        setErr(res.error);
        return;
      }
      setCompleting(false);
      router.refresh();
    });
  }

  function handleReschedule() {
    setErr(null);
    if (!newDate) return;
    startTransition(async () => {
      const res = await rescheduleEntryAction(entry.id, entry.kind, newDate);
      if ("error" in res) {
        setErr(res.error);
        return;
      }
      setEditingDate(false);
      router.refresh();
    });
  }

  function handleCancel() {
    setErr(null);
    const ok = window.confirm(
      `Cancel this scheduled ${logTypeLabel(entry.logType).toLowerCase()} for ${entry.horseName}?`,
    );
    if (!ok) return;
    startTransition(async () => {
      const res = await cancelScheduledEntryAction(entry.id, entry.kind);
      if ("error" in res) {
        setErr(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div
      className="rounded-lg border bg-white px-3 py-2"
      style={{
        borderColor: isOverdue ? "rgba(184,66,31,0.35)" : "rgba(42,64,49,0.12)",
        background: isOverdue ? "rgba(184,66,31,0.04)" : "white",
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/horses/${entry.horseId}`}
          className="text-sm font-medium text-barn-dark hover:text-brass-gold"
        >
          {entry.horseName}
        </Link>
        <span className="text-xs text-barn-dark/60">
          {logTypeLabel(entry.logType)}
        </span>
        <span className="text-xs text-barn-dark/55">
          {entryDate.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: entryDate.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
          })}
        </span>
        {isOverdue && (
          <span
            className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
            style={{
              background: "rgba(184,66,31,0.15)",
              color: "#b8421f",
            }}
          >
            Overdue
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          {completing ? null : editingDate ? (
            <>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="rounded-md border px-2 py-1 text-xs outline-none"
                style={{ borderColor: "rgba(42,64,49,0.2)" }}
              />
              <button
                type="button"
                onClick={handleReschedule}
                disabled={pending}
                className="rounded-md px-2 py-1 text-xs font-semibold disabled:opacity-60"
                style={{ background: "#c9a84c", color: "#2a4031" }}
              >
                {pending ? "…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingDate(false);
                  setNewDate(entry.date.slice(0, 10));
                }}
                disabled={pending}
                className="rounded-md border px-2 py-1 text-xs text-barn-dark/70"
                style={{ borderColor: "rgba(42,64,49,0.15)" }}
              >
                ✕
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setCompleting(true)}
                disabled={pending}
                className="rounded-md px-2 py-1 text-xs font-semibold disabled:opacity-60"
                style={{ background: "#c9a84c", color: "#2a4031" }}
                title="Mark this entry done"
              >
                Done
              </button>
              <button
                type="button"
                onClick={() => setEditingDate(true)}
                disabled={pending}
                className="rounded-md border px-2 py-1 text-xs font-medium text-barn-dark/80"
                style={{ borderColor: "rgba(42,64,49,0.15)" }}
                title="Reschedule"
              >
                Move
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={pending}
                aria-label="Cancel scheduled entry"
                title="Cancel"
                className="rounded-md px-1.5 py-1 text-xs text-barn-dark/50 hover:text-[#b8421f]"
              >
                ✕
              </button>
            </>
          )}
        </div>
      </div>
      {entry.notes && !completing && (
        <div className="mt-1 text-xs text-barn-dark/55 truncate">
          {entry.notes}
        </div>
      )}
      {completing && (
        <div className="mt-2 rounded-md border border-dashed p-2"
          style={{ borderColor: "rgba(42,64,49,0.2)", background: "rgba(42,64,49,0.03)" }}>
          <div className="text-[11px] font-medium text-barn-dark/65 mb-1.5">
            Complete this entry
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={doneCost}
              onChange={(e) => setDoneCost(e.target.value)}
              placeholder="Cost ($)"
              className="w-24 rounded-md border px-2 py-1 text-xs outline-none"
              style={{ borderColor: "rgba(42,64,49,0.2)" }}
            />
            <input
              type="text"
              value={doneNotes}
              onChange={(e) => setDoneNotes(e.target.value)}
              placeholder="Notes"
              className="flex-1 min-w-[8rem] rounded-md border px-2 py-1 text-xs outline-none"
              style={{ borderColor: "rgba(42,64,49,0.2)" }}
            />
            <button
              type="button"
              onClick={() => submitDone()}
              disabled={pending}
              className="rounded-md px-2.5 py-1 text-xs font-semibold disabled:opacity-60"
              style={{ background: "#c9a84c", color: "#2a4031" }}
            >
              {pending ? "…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => submitDone({ skipFields: true })}
              disabled={pending}
              className="rounded-md border px-2.5 py-1 text-xs text-barn-dark/75"
              style={{ borderColor: "rgba(42,64,49,0.15)" }}
              title="Mark done without cost or notes"
            >
              Skip
            </button>
            <button
              type="button"
              onClick={() => {
                setCompleting(false);
                setDoneCost("");
                setDoneNotes("");
              }}
              disabled={pending}
              className="rounded-md px-1.5 py-1 text-xs text-barn-dark/55"
              title="Cancel"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      {err && (
        <div className="mt-1 text-xs" style={{ color: "#b8421f" }}>
          {err}
        </div>
      )}
    </div>
  );
}
