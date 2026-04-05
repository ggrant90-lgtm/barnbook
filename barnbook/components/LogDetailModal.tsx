"use client";

import { logTypeLabel } from "@/lib/horse-form-constants";
import { getActivitySummary, getHealthSummary } from "@/lib/horse-display";
import { formatDateTime, formatDateShort } from "@/lib/format-date";
import type { ActivityLog, HealthRecord, LogMedia } from "@/lib/types";
import { useCallback, useEffect } from "react";

type LogItem =
  | { kind: "activity"; entry: ActivityLog }
  | { kind: "health"; entry: HealthRecord };

interface LogDetailModalProps {
  item: LogItem;
  media: LogMedia[];
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
  const details = entry.details as Record<string, unknown> | null;

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
