import { formatDateTime } from "@/lib/format-date";
import { getActivitySummary } from "@/lib/horse-display";
import { logTypeLabel } from "@/lib/horse-form-constants";
import type { ActivityLog } from "@/lib/types";

export type ActivityEntryProps = {
  activity: ActivityLog;
  loggerName?: string | null;
  loggerBarn?: string | null;
  onClick?: () => void;
};

export function ActivityEntry({ activity: a, loggerName, loggerBarn, onClick }: ActivityEntryProps) {
  const summary = getActivitySummary(a);
  const truncatedNotes = a.notes && a.notes.length > 60
    ? a.notes.slice(0, 60) + "..."
    : a.notes;

  return (
    <li
      className={`flex flex-col gap-1 py-3 sm:flex-row sm:justify-between ${
        onClick ? "cursor-pointer rounded-lg px-2 -mx-2 transition hover:bg-parchment/60" : ""
      }`}
      onClick={onClick}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="inline-block rounded-full bg-brass-gold/15 px-2 py-0.5 text-[10px] font-medium text-barn-dark/70">
            {logTypeLabel(a.activity_type)}
          </span>
        </div>
        <p className="mt-1 text-sm text-barn-dark/65">{summary}</p>
        {truncatedNotes ? <p className="text-sm text-barn-dark/55">{truncatedNotes}</p> : null}
        {loggerName ? (
          <p className="mt-0.5 text-[10px] text-barn-dark/40">
            {loggerName}{loggerBarn ? ` · ${loggerBarn}` : ""}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <time className="text-xs text-barn-dark/45" dateTime={a.created_at}>
          {formatDateTime(a.created_at)}
        </time>
        {onClick ? (
          <svg className="h-4 w-4 text-barn-dark/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        ) : null}
      </div>
    </li>
  );
}
