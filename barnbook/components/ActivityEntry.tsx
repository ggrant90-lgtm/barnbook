import { formatDateTime } from "@/lib/format-date";
import { getActivitySummary } from "@/lib/horse-display";
import type { ActivityLog } from "@/lib/types";

export type ActivityEntryProps = {
  activity: ActivityLog;
};

export function ActivityEntry({ activity: a }: ActivityEntryProps) {
  return (
    <li className="flex flex-col gap-1 py-3 sm:flex-row sm:justify-between">
      <div>
        <p className="font-medium capitalize text-barn-dark">{a.activity_type}</p>
        <p className="text-sm text-barn-dark/65">{getActivitySummary(a)}</p>
        {a.notes ? <p className="text-sm text-barn-dark/55">{a.notes}</p> : null}
      </div>
      <time className="text-xs text-barn-dark/45" dateTime={a.created_at}>
        {formatDateTime(a.created_at)}
      </time>
    </li>
  );
}
