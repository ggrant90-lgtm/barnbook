import Link from "next/link";
import { UpcomingRow } from "./UpcomingRow";

/**
 * Minimal shape of a planned log entry for the dashboard strip.
 * Keeps the server → client boundary tight: dates are raw ISO strings,
 * type is the canonical logType key (exercise, shoeing, etc.), and the
 * notes field is optional. The row component handles display.
 */
export interface UpcomingEntry {
  id: string;
  kind: "activity" | "health";
  horseId: string;
  horseName: string;
  logType: string;
  /** ISO string — may be in the past if the entry is overdue. */
  date: string;
  notes: string | null;
}

/**
 * Service Barn "Upcoming" strip. Shows the next planned entries for
 * the provider, including overdue ones (dates ≤ today). Limited to 5
 * rows at a glance with an overflow link to the calendar.
 *
 * Renders nothing when there's no upcoming work so the dashboard
 * stays quiet for new users.
 */
export function UpcomingStrip({
  entries,
  serviceBarnId,
}: {
  entries: UpcomingEntry[];
  serviceBarnId: string;
}) {
  if (entries.length === 0) return null;

  const visible = entries.slice(0, 5);
  const overflow = entries.length - visible.length;

  return (
    <section
      aria-label="Upcoming scheduled work"
      className="mt-4 rounded-xl border bg-white p-3"
      style={{ borderColor: "rgba(42,64,49,0.1)" }}
    >
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-barn-dark/65">
          Today
        </h2>
        <Link
          href="/calendar?scheduled=scheduled"
          className="text-xs font-medium text-brass-gold hover:underline"
        >
          View calendar
        </Link>
      </div>
      <ul className="space-y-1.5">
        {visible.map((e) => (
          <li key={`${e.kind}-${e.id}`}>
            <UpcomingRow entry={e} />
          </li>
        ))}
      </ul>
      {overflow > 0 && (
        <Link
          href={`/calendar?scheduled=scheduled&barn=${serviceBarnId}`}
          className="mt-2 inline-block text-xs font-medium text-barn-dark/60 hover:text-brass-gold"
        >
          {overflow} more on the calendar →
        </Link>
      )}
    </section>
  );
}
