"use client";

import Link from "next/link";
import { getLogTypeColor, getLogTypeLabel } from "@/lib/logTypeColors";
import type { CalendarEvent } from "@/app/(protected)/actions/calendar";

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatDay(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function EventRow({ event }: { event: CalendarEvent }) {
  const color = getLogTypeColor(event.extendedProps.logType);

  return (
    <Link
      href={`/horses/${event.extendedProps.horseId}?tab=${event.extendedProps.kind === "health" ? "health" : "activity"}&highlight=${event.extendedProps.entryId}`}
      className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-parchment/50 transition group"
    >
      <span className="text-xs text-barn-dark/40 w-14 shrink-0 tabular-nums">
        {formatTime(event.start)}
      </span>
      <span
        className="h-2.5 w-2.5 rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />
      <div className="min-w-0 flex-1">
        <div className="text-sm text-barn-dark truncate">
          {getLogTypeLabel(event.extendedProps.logType)} — {event.extendedProps.horseName}
        </div>
        {event.extendedProps.performedByName && (
          <div className="text-xs text-barn-dark/40 truncate">
            {event.extendedProps.performedByName}
          </div>
        )}
      </div>
      {event.extendedProps.totalCost != null && (
        <span className="text-xs text-barn-dark/50 shrink-0">
          ${event.extendedProps.totalCost.toFixed(2)}
        </span>
      )}
    </Link>
  );
}

export function TodayWidget({
  today,
  upcoming,
}: {
  today: CalendarEvent[];
  upcoming: CalendarEvent[];
}) {
  return (
    <div className="space-y-4">
      {/* Today */}
      <div className="rounded-2xl border border-barn-dark/10 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-serif text-base font-semibold text-barn-dark">Today</h3>
          <Link
            href="/calendar"
            className="text-xs text-brass-gold hover:underline"
          >
            View calendar →
          </Link>
        </div>

        {today.length === 0 ? (
          <p className="text-sm text-barn-dark/40 py-2">Nothing scheduled for today.</p>
        ) : (
          <div className="divide-y divide-barn-dark/5 -mx-3">
            {today.map((e) => (
              <EventRow key={e.id} event={e} />
            ))}
          </div>
        )}
      </div>

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div className="rounded-2xl border border-barn-dark/10 bg-white p-4 shadow-sm">
          <h3 className="font-serif text-sm font-semibold text-barn-dark mb-3">
            Upcoming (next 7 days)
          </h3>

          <div className="divide-y divide-barn-dark/5 -mx-3">
            {upcoming.slice(0, 10).map((e) => (
              <div key={e.id} className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider text-barn-dark/30 w-16 shrink-0 pl-3">
                  {formatDay(e.start)}
                </span>
                <div className="flex-1 min-w-0">
                  <EventRow event={e} />
                </div>
              </div>
            ))}
          </div>

          {upcoming.length > 10 && (
            <Link
              href="/calendar?scheduled=scheduled"
              className="block mt-2 text-center text-xs text-brass-gold hover:underline"
            >
              +{upcoming.length - 10} more →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
