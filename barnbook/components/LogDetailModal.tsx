"use client";

import { logTypeLabel } from "@/lib/horse-form-constants";
import { getActivitySummary, getHealthSummary } from "@/lib/horse-display";
import { formatDateTime, formatDateShort } from "@/lib/format-date";
import type { ActivityLog, HealthRecord, LogMedia, LogEntryLineItem } from "@/lib/types";
import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  cancelScheduledEntryAction,
  markEntryCompletedAction,
  rescheduleEntryAction,
} from "@/app/(protected)/actions/scheduled-entries";

type LogItem =
  | { kind: "activity"; entry: ActivityLog }
  | { kind: "health"; entry: HealthRecord };

function formatCurrency(val: number): string {
  return val.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

interface LogDetailModalProps {
  item: LogItem;
  media: LogMedia[];
  lineItems?: LogEntryLineItem[];
  performerName?: string | null;
  performerRole?: string | null;
  loggerName?: string | null;
  loggerBarn?: string | null;
  onClose: () => void;
  canEdit?: boolean;
  canDelete?: boolean;
  onDelete?: () => void;
  horseId?: string;
}

export function LogDetailModal({
  item,
  media,
  lineItems,
  performerName,
  performerRole,
  loggerName,
  loggerBarn,
  onClose,
  canEdit,
  canDelete,
  onDelete,
  horseId,
}: LogDetailModalProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [plannedPending, startPlannedTransition] = useTransition();
  const [plannedErr, setPlannedErr] = useState<string | null>(null);
  const [reschedOpen, setReschedOpen] = useState(false);
  const [reschedDate, setReschedDate] = useState<string>("");
  const [completingOpen, setCompletingOpen] = useState(false);
  const [doneCost, setDoneCost] = useState("");
  const [doneNotes, setDoneNotes] = useState("");
  const plannedRouter = useRouter();
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const isActivity = item.kind === "activity";
  const entry = item.entry;
  const isPlanned = entry.status === "planned";
  const typeName = isActivity
    ? logTypeLabel((entry as ActivityLog).activity_type)
    : (entry as HealthRecord).record_type;

  function submitDone(options?: { skipFields?: boolean }) {
    setPlannedErr(null);
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

    startPlannedTransition(async () => {
      const res = await markEntryCompletedAction(entry.id, item.kind, {
        cost: costToSend,
        notes: notesToSend,
      });
      if ("error" in res) {
        setPlannedErr(res.error);
        return;
      }
      onClose();
      plannedRouter.refresh();
    });
  }

  function commitReschedule() {
    if (!reschedDate) return;
    setPlannedErr(null);
    startPlannedTransition(async () => {
      const res = await rescheduleEntryAction(entry.id, item.kind, reschedDate);
      if ("error" in res) {
        setPlannedErr(res.error);
        return;
      }
      setReschedOpen(false);
      onClose();
      plannedRouter.refresh();
    });
  }

  function cancelPlanned() {
    const ok = window.confirm("Cancel this scheduled entry?");
    if (!ok) return;
    setPlannedErr(null);
    startPlannedTransition(async () => {
      const res = await cancelScheduledEntryAction(entry.id, item.kind);
      if ("error" in res) {
        setPlannedErr(res.error);
        return;
      }
      onClose();
      plannedRouter.refresh();
    });
  }
  const date = isActivity
    ? formatDateTime((entry as ActivityLog).created_at)
    : formatDateShort((entry as HealthRecord).record_date);
  const notes = entry.notes;
  const rawDetails = entry.details;
  const details: Record<string, unknown> | null =
    typeof rawDetails === "string"
      ? (() => { try { return JSON.parse(rawDetails); } catch { return null; } })()
      : (rawDetails as Record<string, unknown> | null);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      onClick={onClose}
    >
      <div className="fixed inset-0 bg-black/40" />
      <div
        className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-block rounded-full bg-brass-gold/15 px-3 py-1 text-xs font-medium text-barn-dark">
                {typeName}
              </span>
              {isPlanned && (
                <span
                  className="inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                  style={{
                    background: "rgba(75,100,121,0.15)",
                    color: "#4b6479",
                  }}
                >
                  Planned
                </span>
              )}
              {!isPlanned && entry.was_scheduled && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                  style={{
                    background: "rgba(75,100,121,0.12)",
                    color: "#4b6479",
                  }}
                  title="This entry was scheduled ahead and marked done"
                >
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={3}
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Scheduled
                </span>
              )}
            </div>
            <p className="mt-2 text-xs text-barn-dark/50">{date}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-barn-dark/40 hover:bg-barn-dark/5 hover:text-barn-dark"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Summary */}
        <p className="mt-3 text-sm font-medium text-barn-dark">
          {isActivity
            ? getActivitySummary(entry as ActivityLog)
            : getHealthSummary(entry as HealthRecord)}
        </p>

        {/* Planned-entry actions: Mark done / Reschedule / Cancel */}
        {isPlanned && (
          <div
            className="mt-3 rounded-lg border p-3"
            style={{
              borderColor: "rgba(75,100,121,0.25)",
              background: "rgba(75,100,121,0.06)",
            }}
          >
            {completingOpen ? (
              <div className="space-y-2">
                <div className="text-xs font-medium text-barn-dark/70">
                  Complete this entry — capture what actually happened.
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={doneCost}
                    onChange={(e) => setDoneCost(e.target.value)}
                    placeholder="Cost ($)"
                    className="w-28 rounded-md border px-2 py-1 text-sm outline-none"
                    style={{ borderColor: "rgba(42,64,49,0.2)" }}
                  />
                  <input
                    type="text"
                    value={doneNotes}
                    onChange={(e) => setDoneNotes(e.target.value)}
                    placeholder="Notes"
                    className="flex-1 min-w-[10rem] rounded-md border px-2 py-1 text-sm outline-none"
                    style={{ borderColor: "rgba(42,64,49,0.2)" }}
                  />
                  <button
                    type="button"
                    onClick={() => submitDone()}
                    disabled={plannedPending}
                    className="rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
                    style={{ background: "#c9a84c", color: "#2a4031" }}
                  >
                    {plannedPending ? "…" : "Save & complete"}
                  </button>
                  <button
                    type="button"
                    onClick={() => submitDone({ skipFields: true })}
                    disabled={plannedPending}
                    className="rounded-md border px-3 py-1.5 text-xs text-barn-dark/75"
                    style={{ borderColor: "rgba(42,64,49,0.15)" }}
                    title="Mark done without cost or notes"
                  >
                    Skip
                  </button>
                  <button
                    type="button"
                    onClick={() => setCompletingOpen(false)}
                    disabled={plannedPending}
                    className="rounded-md px-2 py-1.5 text-xs text-barn-dark/55"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ) : reschedOpen ? (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={reschedDate}
                  onChange={(e) => setReschedDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                  className="rounded-md border px-2 py-1 text-sm outline-none"
                  style={{ borderColor: "rgba(42,64,49,0.2)" }}
                />
                <button
                  type="button"
                  onClick={commitReschedule}
                  disabled={plannedPending || !reschedDate}
                  className="rounded-md px-3 py-1 text-xs font-semibold disabled:opacity-60"
                  style={{ background: "#c9a84c", color: "#2a4031" }}
                >
                  {plannedPending ? "…" : "Save date"}
                </button>
                <button
                  type="button"
                  onClick={() => setReschedOpen(false)}
                  disabled={plannedPending}
                  className="rounded-md border px-3 py-1 text-xs"
                  style={{ borderColor: "rgba(42,64,49,0.15)" }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCompletingOpen(true)}
                  disabled={plannedPending}
                  className="rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
                  style={{ background: "#c9a84c", color: "#2a4031" }}
                >
                  Mark done
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReschedDate(
                      (entry.performed_at
                        ? entry.performed_at.slice(0, 10)
                        : !isActivity
                          ? (entry as HealthRecord).record_date
                          : new Date().toISOString().slice(0, 10)) ?? "",
                    );
                    setReschedOpen(true);
                  }}
                  disabled={plannedPending}
                  className="rounded-md border px-3 py-1.5 text-xs font-medium text-barn-dark/80"
                  style={{ borderColor: "rgba(42,64,49,0.15)" }}
                >
                  Reschedule
                </button>
                <button
                  type="button"
                  onClick={cancelPlanned}
                  disabled={plannedPending}
                  className="rounded-md px-3 py-1.5 text-xs font-medium text-barn-dark/55 hover:text-[#b8421f]"
                >
                  Cancel
                </button>
              </div>
            )}
            {plannedErr && (
              <div
                className="mt-2 text-xs"
                style={{ color: "#b8421f" }}
              >
                {plannedErr}
              </div>
            )}
          </div>
        )}

        {/* Performed by / Performed at */}
        {(performerName || entry.performed_at) && (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {performerName && (
              <span className="text-barn-dark/70">
                <span className="text-barn-dark/40">By:</span>{" "}
                {performerName}
                {performerRole ? (
                  <span className="text-barn-dark/40"> ({performerRole})</span>
                ) : null}
              </span>
            )}
            {entry.performed_at && (
              <span className="text-barn-dark/70">
                <span className="text-barn-dark/40">At:</span>{" "}
                {formatDateTime(entry.performed_at)}
              </span>
            )}
          </div>
        )}

        {/* Cost */}
        {entry.total_cost != null && entry.total_cost > 0 && (
          <div className="mt-3 rounded-lg border border-brass-gold/20 bg-brass-gold/5 p-3">
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-barn-dark/40">
                Cost
              </span>
              <span className="text-lg font-semibold text-barn-dark">
                {formatCurrency(entry.total_cost)}
              </span>
            </div>
            {lineItems && lineItems.length > 0 && (
              <div className="mt-2 space-y-1 border-t border-barn-dark/10 pt-2">
                {lineItems.map((li, i) => (
                  <div key={li.id} className="flex justify-between text-sm">
                    <span className="text-barn-dark/60">
                      {i < lineItems.length - 1 ? "├" : "└"} {li.description}
                    </span>
                    <span className="text-barn-dark/80">
                      {formatCurrency(li.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Full notes */}
        {notes ? (
          <div className="mt-3 rounded-lg bg-parchment/50 p-3">
            <p className="whitespace-pre-wrap text-sm text-barn-dark/80">{notes}</p>
          </div>
        ) : null}

        {/* Detail fields */}
        {details && Object.keys(details).length > 0 ? (
          <div className="mt-4 space-y-1.5">
            {Object.entries(details)
              .filter(([, v]) => v != null && v !== "" && v !== false)
              .map(([key, val]) => (
                <div key={key} className="flex justify-between text-sm">
                  <span className="text-barn-dark/50 capitalize">
                    {key.replace(/_/g, " ")}
                  </span>
                  <span className="text-barn-dark">{String(val)}</span>
                </div>
              ))}
          </div>
        ) : null}

        {/* Media */}
        {media.length > 0 ? (
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-barn-dark/50">Media</p>
            <div className="grid grid-cols-2 gap-2">
              {media.map((m) =>
                m.media_type === "photo" ? (
                  <a key={m.id} href={m.url} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={m.url}
                      alt={m.caption ?? ""}
                      className="aspect-square w-full rounded-lg object-cover"
                    />
                  </a>
                ) : (
                  <video
                    key={m.id}
                    src={m.url}
                    controls
                    className="aspect-video w-full rounded-lg"
                  />
                ),
              )}
            </div>
          </div>
        ) : null}

        {/* Provenance */}
        <div className="mt-4 border-t border-barn-dark/10 pt-3">
          <p className="text-xs text-barn-dark/45">
            Logged by {loggerName ?? "Unknown"}
            {loggerBarn ? ` at ${loggerBarn}` : ""}
          </p>
        </div>

        {/* Edit / Delete */}
        {(canEdit || canDelete) ? (
          <div className="mt-4 border-t border-barn-dark/10 pt-3 flex items-center justify-between">
            {canEdit && horseId ? (
              <Link
                href={`/horses/${horseId}/log/${isActivity ? (entry as ActivityLog).activity_type : (entry as HealthRecord).record_type === "Shoeing" ? "shoeing" : (entry as HealthRecord).record_type === "Worming" ? "worming" : "vet_visit"}?edit=${entry.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brass-gold/10 px-3 py-1.5 text-sm font-medium text-brass-gold hover:bg-brass-gold/20 transition"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                </svg>
                Edit
              </Link>
            ) : <span />}
            {canDelete ? (
              confirmingDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-barn-dark/50">Delete this entry?</span>
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={async () => {
                      setDeleting(true);
                      onDelete?.();
                    }}
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50 transition"
                  >
                    {deleting ? "Deleting…" : "Yes, delete"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(false)}
                    className="rounded-lg bg-barn-dark/5 px-3 py-1.5 text-xs font-medium text-barn-dark/60 hover:bg-barn-dark/10 transition"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  className="text-sm text-red-500/70 hover:text-red-600 transition"
                >
                  Delete
                </button>
              )
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
