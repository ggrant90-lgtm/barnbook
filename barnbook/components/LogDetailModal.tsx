"use client";

import { logTypeLabel } from "@/lib/horse-form-constants";
import { getActivitySummary, getHealthSummary } from "@/lib/horse-display";
import { formatDateTime, formatDateShort } from "@/lib/format-date";
import type { ActivityLog, HealthRecord, LogMedia, LogEntryLineItem } from "@/lib/types";
import { useCallback, useEffect } from "react";

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
  canDelete,
  onDelete,
}: LogDetailModalProps) {
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
  const typeName = isActivity
    ? logTypeLabel((entry as ActivityLog).activity_type)
    : (entry as HealthRecord).record_type;
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
            <span className="inline-block rounded-full bg-brass-gold/15 px-3 py-1 text-xs font-medium text-barn-dark">
              {typeName}
            </span>
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

        {/* Delete */}
        {canDelete ? (
          <div className="mt-4 border-t border-barn-dark/10 pt-3">
            <button
              type="button"
              onClick={onDelete}
              className="text-sm text-red-600 hover:text-red-700"
            >
              Delete entry
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
