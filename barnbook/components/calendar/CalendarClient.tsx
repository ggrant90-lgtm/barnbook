"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import type { EventClickArg, DateSelectArg, EventDropArg } from "@fullcalendar/core";
import type { CalendarEvent } from "@/app/(protected)/actions/calendar";
import {
  getCalendarEvents,
  rescheduleLogEntry,
} from "@/app/(protected)/actions/calendar";
import { CalendarFilters } from "./CalendarFilters";
import { FilterChips } from "./FilterChips";
import { CalendarQuickAdd } from "./CalendarQuickAdd";
import { getLogTypeColor, getLogTypeLabel } from "@/lib/logTypeColors";

// Dynamic import FullCalendar to avoid SSR
const FullCalendar = dynamic(
  () =>
    Promise.all([
      import("@fullcalendar/react"),
      import("@fullcalendar/daygrid"),
      import("@fullcalendar/timegrid"),
      import("@fullcalendar/interaction"),
    ]).then(([fc, dg, tg, int]) => {
      // Register plugins on the default export
      const FC = fc.default;
      const WrappedFC = (props: Record<string, unknown>) => (
        <FC {...props} plugins={[dg.default, tg.default, int.default]} />
      );
      WrappedFC.displayName = "FullCalendarWrapper";
      return { default: WrappedFC };
    }),
  { ssr: false, loading: () => <div className="flex items-center justify-center py-20 text-barn-dark/40">Loading calendar…</div> },
);

interface BarnMember {
  id: string;
  name: string;
  role: string;
}

interface Horse {
  id: string;
  name: string;
}

interface Props {
  barnId: string;
  initialEvents: CalendarEvent[];
  horses: Horse[];
  barnMembers: BarnMember[];
  currentUserId: string;
  /** When true, getCalendarEvents is called in Service Barn mode:
   *  quick records + linked horses (filtered to this user's own
   *  entries for the linked set). */
  serviceBarnMode?: boolean;
}

export function CalendarClient({
  barnId,
  initialEvents,
  horses,
  barnMembers,
  currentUserId,
  serviceBarnMode = false,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const calendarRef = useRef<{ getApi: () => { getDate: () => Date; prev: () => void; next: () => void; today: () => void; changeView: (v: string) => void } } | null>(null);

  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents);
  const [view, setView] = useState<string>(searchParams.get("view") ?? "timeGridWeek");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [quickAdd, setQuickAdd] = useState<{ date: string; time: string } | null>(null);
  const [calendarDate, setCalendarDate] = useState(() => new Date());

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const goToMonth = (monthIndex: number) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (calendarRef.current as any)?.getApi?.();
    if (!api) return;
    const year = calendarDate.getFullYear();
    api.gotoDate(new Date(year, monthIndex, 1));
    setCalendarDate(new Date(year, monthIndex, 1));
  };

  const changeYear = (delta: number) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (calendarRef.current as any)?.getApi?.();
    if (!api) return;
    const newYear = calendarDate.getFullYear() + delta;
    const month = calendarDate.getMonth();
    api.gotoDate(new Date(newYear, month, 1));
    setCalendarDate(new Date(newYear, month, 1));
  };

  // Parse filters from URL
  const [filters, setFilters] = useState(() => ({
    horses: searchParams.get("horses")?.split(",").filter(Boolean) ?? [],
    types: searchParams.get("types")?.split(",").filter(Boolean) ?? [],
    performers: searchParams.get("performers")?.split(",").filter(Boolean) ?? [],
    minCost: searchParams.get("minCost") ? Number(searchParams.get("minCost")) : undefined,
    maxCost: searchParams.get("maxCost") ? Number(searchParams.get("maxCost")) : undefined,
    hasNotes: searchParams.get("hasNotes") === "true",
    hasCost: searchParams.get("hasCost") === "true",
    scheduled: (searchParams.get("scheduled") ?? "all") as "all" | "scheduled" | "completed",
    keyword: searchParams.get("q") ?? "",
  }));

  // Sync filters to URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.horses.length) params.set("horses", filters.horses.join(","));
    if (filters.types.length) params.set("types", filters.types.join(","));
    if (filters.performers.length) params.set("performers", filters.performers.join(","));
    if (filters.minCost !== undefined) params.set("minCost", String(filters.minCost));
    if (filters.maxCost !== undefined) params.set("maxCost", String(filters.maxCost));
    if (filters.hasNotes) params.set("hasNotes", "true");
    if (filters.hasCost) params.set("hasCost", "true");
    if (filters.scheduled !== "all") params.set("scheduled", filters.scheduled);
    if (filters.keyword) params.set("q", filters.keyword);
    if (view !== "timeGridWeek") params.set("view", view);

    const str = params.toString();
    router.replace(`/calendar${str ? `?${str}` : ""}`, { scroll: false });
  }, [filters, view, router]);

  // Fetch events when filters or date range changes
  const fetchEvents = useCallback(
    async (start?: string, end?: string) => {
      setLoading(true);
      const now = new Date();
      const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString();

      const result = await getCalendarEvents({
        barnId,
        start: start ?? defaultStart,
        end: end ?? defaultEnd,
        horses: filters.horses.length ? filters.horses : undefined,
        types: filters.types.length ? filters.types : undefined,
        performers: filters.performers.length ? filters.performers : undefined,
        minCost: filters.minCost,
        maxCost: filters.maxCost,
        hasNotes: filters.hasNotes || undefined,
        hasCost: filters.hasCost || undefined,
        serviceBarnMode,
        scheduled: filters.scheduled !== "all" ? filters.scheduled : undefined,
        keyword: filters.keyword || undefined,
      });

      setEvents(result.events);
      setLoading(false);
    },
    [barnId, filters, serviceBarnMode],
  );

  // Debounced refetch when filters change
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchEvents();
    }, 200);
    return () => clearTimeout(timer);
  }, [fetchEvents]);

  const handleEventClick = useCallback(
    (info: EventClickArg) => {
      const { kind, entryId, horseId } = info.event.extendedProps;
      const tab = kind === "health" ? "health" : "activity";
      router.push(`/horses/${horseId}?tab=${tab}&highlight=${entryId}`);
    },
    [router],
  );

  const handleDateSelect = useCallback((info: DateSelectArg) => {
    const d = new Date(info.start);
    setQuickAdd({
      date: d.toISOString().slice(0, 10),
      time: d.toTimeString().slice(0, 5),
    });
  }, []);

  const handleEventDrop = useCallback(
    async (info: EventDropArg) => {
      const { kind, entryId } = info.event.extendedProps;
      const newStart = info.event.start;
      if (!newStart) return;

      const result = await rescheduleLogEntry(kind, entryId, newStart.toISOString());
      if (result.error) {
        info.revert();
        setToast("Failed to reschedule");
      } else {
        setToast(`Moved to ${newStart.toLocaleDateString()} ${newStart.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`);
      }
      setTimeout(() => setToast(null), 3000);
    },
    [],
  );

  const handleDatesSet = useCallback(
    (dateInfo: { start: Date; end: Date }) => {
      fetchEvents(dateInfo.start.toISOString(), dateInfo.end.toISOString());
      // Sync the displayed month (midpoint of the visible range)
      const mid = new Date((dateInfo.start.getTime() + dateInfo.end.getTime()) / 2);
      setCalendarDate(mid);
    },
    [fetchEvents],
  );

  const hasActiveFilters =
    filters.horses.length > 0 ||
    filters.types.length > 0 ||
    filters.performers.length > 0 ||
    filters.minCost !== undefined ||
    filters.maxCost !== undefined ||
    filters.hasNotes ||
    filters.hasCost ||
    filters.scheduled !== "all" ||
    filters.keyword !== "";

  const clearAllFilters = () => {
    setFilters({
      horses: [],
      types: [],
      performers: [],
      minCost: undefined,
      maxCost: undefined,
      hasNotes: false,
      hasCost: false,
      scheduled: "all",
      keyword: "",
    });
  };

  const allLogTypes = [
    "exercise", "feed", "medication", "note",
    "heat_detected", "bred_ai", "ultrasound", "flush_embryo", "foaling",
    "shoeing", "worming", "vet_visit",
  ];

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <CalendarFilters
        horses={horses}
        logTypes={allLogTypes}
        barnMembers={barnMembers}
        filters={filters}
        onFiltersChange={setFilters}
        hasActiveFilters={hasActiveFilters}
        onClearAll={clearAllFilters}
      />

      {/* Filter chips */}
      {hasActiveFilters && (
        <FilterChips
          filters={filters}
          horses={horses}
          barnMembers={barnMembers}
          onRemove={(key, value) => {
            setFilters((prev) => {
              const next = { ...prev };
              if (key === "horses") next.horses = prev.horses.filter((h) => h !== value);
              else if (key === "types") next.types = prev.types.filter((t) => t !== value);
              else if (key === "performers") next.performers = prev.performers.filter((p) => p !== value);
              else if (key === "minCost") next.minCost = undefined;
              else if (key === "maxCost") next.maxCost = undefined;
              else if (key === "hasNotes") next.hasNotes = false;
              else if (key === "hasCost") next.hasCost = false;
              else if (key === "scheduled") next.scheduled = "all";
              else if (key === "keyword") next.keyword = "";
              return next;
            });
          }}
          onClearAll={clearAllFilters}
        />
      )}

      {/* View switcher row */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-barn-dark/40 uppercase tracking-wider">
          {loading ? "Loading…" : `${events.length} events`}
        </div>
        <div className="flex rounded-lg border border-barn-dark/15 bg-white overflow-hidden">
          {(
            [
              ["timeGridDay", "Day"],
              ["timeGridWeek", "Week"],
              ["dayGridMonth", "Month"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                setView(v);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (calendarRef.current as any)?.getApi?.()?.changeView?.(v);
              }}
              className={`px-3 py-1.5 text-sm font-medium transition ${
                view === v
                  ? "bg-brass-gold text-barn-dark"
                  : "text-barn-dark/60 hover:bg-parchment"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Month picker */}
      <div className="rounded-xl border border-barn-dark/10 bg-white p-3">
        <div className="flex items-center justify-between mb-2">
          <button
            type="button"
            onClick={() => changeYear(-1)}
            className="rounded-lg px-2 py-1 text-sm font-medium text-barn-dark/50 hover:bg-parchment hover:text-barn-dark transition"
            aria-label="Previous year"
          >
            ‹ {calendarDate.getFullYear() - 1}
          </button>
          <span className="text-sm font-semibold text-barn-dark">
            {calendarDate.getFullYear()}
          </span>
          <button
            type="button"
            onClick={() => changeYear(1)}
            className="rounded-lg px-2 py-1 text-sm font-medium text-barn-dark/50 hover:bg-parchment hover:text-barn-dark transition"
            aria-label="Next year"
          >
            {calendarDate.getFullYear() + 1} ›
          </button>
        </div>
        <div className="grid grid-cols-6 gap-1 sm:grid-cols-12">
          {MONTHS.map((m, i) => {
            const isActive = calendarDate.getMonth() === i;
            const isCurrentMonth = new Date().getMonth() === i && new Date().getFullYear() === calendarDate.getFullYear();
            return (
              <button
                key={m}
                type="button"
                onClick={() => goToMonth(i)}
                className={`rounded-lg px-1 py-1.5 text-xs font-medium transition ${
                  isActive
                    ? "bg-brass-gold text-barn-dark"
                    : isCurrentMonth
                      ? "bg-brass-gold/15 text-barn-dark hover:bg-brass-gold/25"
                      : "text-barn-dark/60 hover:bg-parchment"
                }`}
              >
                {m}
              </button>
            );
          })}
        </div>
      </div>

      {/* Calendar */}
      <div className="rounded-xl border border-barn-dark/10 bg-white p-2 sm:p-4 overflow-hidden">
        <style jsx global>{`
          .fc { font-family: inherit; }
          .fc .fc-toolbar { margin-bottom: 1rem; }
          .fc .fc-toolbar-title { font-size: 1.1rem; font-weight: 600; color: #1a1207; }
          .fc .fc-button { background: #f5f0e8; border: 1px solid rgba(26,18,7,0.15); color: #1a1207; font-size: 0.8rem; padding: 0.35rem 0.7rem; border-radius: 0.5rem; }
          .fc .fc-button:hover { background: #ede3d1; }
          .fc .fc-button-active { background: #c9a84c !important; border-color: #c9a84c !important; color: #1a1207 !important; }
          .fc .fc-today-button { background: #c9a84c; border-color: #c9a84c; color: #1a1207; font-weight: 500; }
          .fc .fc-today-button:disabled { opacity: 0.5; }
          .fc td.fc-day-today { background: rgba(201,168,76,0.08) !important; }
          .fc .fc-event { border-radius: 4px; padding: 1px 4px; font-size: 0.75rem; cursor: pointer; border-width: 2px; }
          .fc-event-scheduled { border-style: dashed !important; opacity: 0.8; }
          .fc .fc-col-header-cell { background: #f5f0e8; font-size: 0.75rem; font-weight: 600; color: rgba(26,18,7,0.6); }
          .fc .fc-timegrid-slot { height: 2.5rem; }
          .fc .fc-scrollgrid { border-color: rgba(26,18,7,0.1); }
          .fc td, .fc th { border-color: rgba(26,18,7,0.08) !important; }
          @media (max-width: 640px) {
            .fc .fc-toolbar { flex-direction: column; gap: 0.5rem; }
            .fc .fc-toolbar-title { font-size: 0.95rem; }
            .fc .fc-header-toolbar { display: none; }
          }
          .fc .fc-multimonth-button,
          .fc .fc-dayGridYear-button { display: none; }
        `}</style>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <FullCalendar
          ref={calendarRef as any}
          initialView={view}
          events={events}
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "",
          }}
          editable={true}
          selectable={true}
          selectMirror={true}
          eventClick={handleEventClick}
          select={handleDateSelect}
          eventDrop={handleEventDrop}
          datesSet={handleDatesSet}
          height="auto"
          nowIndicator={true}
          slotMinTime="05:00:00"
          slotMaxTime="22:00:00"
          firstDay={1}
          allDaySlot={false}
          eventDisplay="block"
          slotEventOverlap={false}
        />
      </div>

      {/* Quick add modal */}
      {quickAdd && (
        <CalendarQuickAdd
          barnId={barnId}
          horses={horses}
          barnMembers={barnMembers}
          currentUserId={currentUserId}
          defaultDate={quickAdd.date}
          defaultTime={quickAdd.time}
          onClose={() => setQuickAdd(null)}
          onCreated={() => {
            setQuickAdd(null);
            fetchEvents();
            setToast("Entry created");
            setTimeout(() => setToast(null), 3000);
          }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-xl bg-barn-dark px-5 py-3 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
