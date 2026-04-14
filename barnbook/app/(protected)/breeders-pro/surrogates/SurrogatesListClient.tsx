"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Horse, Pregnancy } from "@/lib/types";
import { BreedersProChrome } from "@/components/breeders-pro/BreedersProChrome";

/* --------------------------------------------------------------------
 * Surrogates — list view.
 *
 * Presentation only. Availability, current gestation days, and lifetime
 * totals are computed client-side from the pregnancies array.
 * ------------------------------------------------------------------ */

type SurrogateLite = Pick<
  Horse,
  | "id"
  | "name"
  | "registration_number"
  | "breed"
  | "color"
  | "breeding_role"
  | "reproductive_status"
  | "recipient_herd_id"
  | "archived"
>;

type PregnancyLite = Pick<
  Pregnancy,
  "surrogate_horse_id" | "status" | "transfer_date" | "expected_foaling_date"
>;

type FilterId = "all" | "available" | "in_use" | "archived";

function fmtMonthDay(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString(undefined, {
    year: "2-digit",
    month: "short",
    day: "2-digit",
  });
}

function gestationDays(transferIso: string): number {
  const t = new Date(transferIso);
  if (Number.isNaN(t.getTime())) return 0;
  return Math.max(
    0,
    Math.floor((Date.now() - t.getTime()) / (1000 * 60 * 60 * 24)),
  );
}

function daysTo(iso: string | null): number | null {
  if (!iso) return null;
  const end = new Date(iso);
  if (Number.isNaN(end.getTime())) return null;
  return Math.floor((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export function SurrogatesListClient({
  surrogates,
  pregnancies,
}: {
  surrogates: SurrogateLite[];
  pregnancies: PregnancyLite[];
}) {
  const [filter, setFilter] = useState<FilterId>("all");
  const [query, setQuery] = useState("");

  // ---------- Rollups per surrogate ----------
  const rollups = useMemo(() => {
    const map = new Map<
      string,
      {
        total: number;
        foaled: number;
        lost: number;
        current: PregnancyLite | null;
      }
    >();
    for (const s of surrogates) {
      map.set(s.id, {
        total: 0,
        foaled: 0,
        lost: 0,
        current: null,
      });
    }
    for (const p of pregnancies) {
      const entry = map.get(p.surrogate_horse_id);
      if (!entry) continue;
      entry.total += 1;
      if (p.status === "foaled") entry.foaled += 1;
      if (
        p.status === "lost_early" ||
        p.status === "lost_late" ||
        p.status === "aborted"
      ) {
        entry.lost += 1;
      }
      if (
        (p.status === "pending_check" || p.status === "confirmed") &&
        (!entry.current ||
          new Date(p.transfer_date).getTime() >
            new Date(entry.current.transfer_date).getTime())
      ) {
        entry.current = p;
      }
    }
    return map;
  }, [surrogates, pregnancies]);

  // ---------- Counts for filter chips ----------
  const counts = useMemo(() => {
    let available = 0;
    let inUse = 0;
    let archived = 0;
    for (const s of surrogates) {
      if (s.archived) {
        archived += 1;
        continue;
      }
      const r = rollups.get(s.id);
      if (r?.current) inUse += 1;
      else available += 1;
    }
    return { available, inUse, archived, all: surrogates.length };
  }, [surrogates, rollups]);

  // ---------- Filtered + sorted rows ----------
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = surrogates.filter((s) => {
      if (filter === "archived" && !s.archived) return false;
      if (filter !== "archived" && s.archived) return false;
      const r = rollups.get(s.id);
      if (filter === "available" && r?.current) return false;
      if (filter === "in_use" && !r?.current) return false;
      if (q) {
        const hay =
          `${s.name} ${s.registration_number ?? ""} ${s.breed ?? ""} ${s.recipient_herd_id ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    // In-use mares first (sorted by days-to-foal ascending), then available
    // mares (by name), then archived (by name).
    return [...filtered].sort((a, b) => {
      const ra = rollups.get(a.id);
      const rb = rollups.get(b.id);
      const aInUse = !!ra?.current;
      const bInUse = !!rb?.current;
      if (aInUse && !bInUse) return -1;
      if (!aInUse && bInUse) return 1;
      if (aInUse && bInUse) {
        const daysA = daysTo(ra!.current!.expected_foaling_date);
        const daysB = daysTo(rb!.current!.expected_foaling_date);
        if (daysA == null && daysB == null) return 0;
        if (daysA == null) return 1;
        if (daysB == null) return -1;
        return daysA - daysB;
      }
      return a.name.localeCompare(b.name);
    });
  }, [surrogates, filter, query, rollups]);

  // ---------- Summary metrics ----------
  const metrics = useMemo(() => {
    let totalTransfers = 0;
    let totalFoaled = 0;
    let totalLost = 0;
    for (const r of rollups.values()) {
      totalTransfers += r.total;
      totalFoaled += r.foaled;
      totalLost += r.lost;
    }
    const successRate =
      totalTransfers > 0
        ? Math.round((totalFoaled / totalTransfers) * 100)
        : null;
    return {
      count: surrogates.length,
      available: counts.available,
      inUse: counts.inUse,
      totalTransfers,
      totalFoaled,
      totalLost,
      successRate,
    };
  }, [surrogates, rollups, counts.available, counts.inUse]);

  const breadcrumb = [
    { label: "Breeders Pro", href: "/breeders-pro" },
    { label: "Surrogates" },
  ];

  const lastUpdated = new Date()
    .toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    .toUpperCase();

  return (
    <BreedersProChrome breadcrumb={breadcrumb}>
      <div className="bp-page-header">
        <div className="bp-page-title-row">
          <div>
            <h1 className="bp-page-title">Surrogates</h1>
            <p className="bp-page-subtitle">
              Recipient mares with availability, current carriage state,
              and lifetime carrier history.
            </p>
          </div>
          <div className="bp-page-meta">
            UPDATED {lastUpdated} · {metrics.available} AVAILABLE ·{" "}
            {metrics.inUse} IN USE
          </div>
        </div>
      </div>

      <div
        className="bp-metrics"
        style={{ gridTemplateColumns: "repeat(5, 1fr)" }}
      >
        <div className="bp-metric">
          <div className="bp-metric-label">Roster</div>
          <div className="bp-metric-value">{metrics.count}</div>
          <div className="bp-metric-delta">
            {metrics.available} avail · {metrics.inUse} in use
          </div>
        </div>
        <div className="bp-metric">
          <div className="bp-metric-label">Total Transfers</div>
          <div className="bp-metric-value">{metrics.totalTransfers}</div>
          <div className="bp-metric-delta">all-time</div>
        </div>
        <div className="bp-metric">
          <div className="bp-metric-label">Foaled</div>
          <div className="bp-metric-value">{metrics.totalFoaled}</div>
          <div className="bp-metric-delta">to term</div>
        </div>
        <div className="bp-metric">
          <div className="bp-metric-label">Losses</div>
          <div className="bp-metric-value">{metrics.totalLost}</div>
          <div className="bp-metric-delta">early + late</div>
        </div>
        <div className="bp-metric">
          <div className="bp-metric-label">Success Rate</div>
          <div className="bp-metric-value">
            {metrics.successRate != null ? `${metrics.successRate}%` : "—"}
          </div>
          <div className="bp-metric-delta">foaled / transferred</div>
        </div>
      </div>

      <div className="bp-toolbar">
        <div className="bp-filters">
          {(
            [
              { id: "all", label: "All", count: counts.all - counts.archived },
              {
                id: "available",
                label: "Available",
                count: counts.available,
              },
              { id: "in_use", label: "In Use", count: counts.inUse },
              {
                id: "archived",
                label: "Archived",
                count: counts.archived,
              },
            ] as { id: FilterId; label: string; count: number }[]
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              className={`bp-chip ${filter === f.id ? "bp-active" : ""}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
              <span className="bp-chip-count">{f.count}</span>
            </button>
          ))}
        </div>
        <div className="bp-search">
          <svg
            className="bp-search-icon"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <circle cx="7" cy="7" r="5" />
            <line x1="11" y1="11" x2="14" y2="14" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, registration, breed, or herd…"
          />
        </div>
      </div>

      <div className="bp-table-wrap">
        <div className="bp-table-container">
          {rows.length === 0 ? (
            <div className="bp-empty">
              {surrogates.length === 0
                ? "No surrogate mares yet. Transfer an embryo to add one."
                : "No surrogates match the current filter."}
            </div>
          ) : (
            <table className="bp-table">
              <thead>
                <tr>
                  <th>Mare</th>
                  <th>Herd</th>
                  <th>Availability</th>
                  <th style={{ textAlign: "right" }}>Gest Day</th>
                  <th>Due</th>
                  <th style={{ textAlign: "right" }}>Transfers</th>
                  <th style={{ textAlign: "right" }}>Foaled</th>
                  <th style={{ textAlign: "right" }}>Success</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => {
                  const r = rollups.get(s.id)!;
                  const href = `/breeders-pro/surrogates/${s.id}`;
                  const inUse = !!r.current;
                  const gest = r.current
                    ? gestationDays(r.current.transfer_date)
                    : null;
                  const dueDate = r.current?.expected_foaling_date ?? null;
                  const dueDays = daysTo(dueDate);
                  const successPct =
                    r.total > 0
                      ? Math.round((r.foaled / r.total) * 100)
                      : null;
                  return (
                    <tr
                      key={s.id}
                      onClick={() => (window.location.href = href)}
                    >
                      <td>
                        <Link
                          href={href}
                          onClick={(e) => e.stopPropagation()}
                          className="bp-donor-cell"
                          style={{ textDecoration: "none", color: "inherit" }}
                        >
                          <span className="bp-donor-name">{s.name}</span>
                          {s.registration_number && (
                            <span className="bp-donor-reg">
                              {s.registration_number}
                            </span>
                          )}
                        </Link>
                      </td>
                      <td>
                        {s.recipient_herd_id ? (
                          <span className="bp-mono">
                            {s.recipient_herd_id}
                          </span>
                        ) : (
                          <span className="bp-empty-cell">—</span>
                        )}
                      </td>
                      <td>
                        <span
                          className={`bp-status ${inUse ? "bp-status-frozen" : "bp-status-fresh"}`}
                        >
                          <span className="bp-status-dot" />
                          {inUse ? "In Use" : "Available"}
                        </span>
                      </td>
                      <td
                        className="bp-mono"
                        style={{ textAlign: "right" }}
                      >
                        {gest != null ? gest : "—"}
                      </td>
                      <td
                        className="bp-mono"
                        style={{
                          color:
                            dueDays != null && dueDays <= 14
                              ? "var(--bp-status-lost)"
                              : dueDays != null && dueDays <= 30
                                ? "var(--bp-status-transferred)"
                                : undefined,
                        }}
                      >
                        {fmtMonthDay(dueDate)}
                      </td>
                      <td
                        className="bp-mono"
                        style={{ textAlign: "right" }}
                      >
                        {r.total}
                      </td>
                      <td
                        className="bp-mono"
                        style={{ textAlign: "right" }}
                      >
                        {r.foaled}
                      </td>
                      <td
                        className="bp-mono"
                        style={{ textAlign: "right" }}
                      >
                        {successPct != null ? `${successPct}%` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        {rows.length > 0 && (
          <div className="bp-table-footer">
            {rows.length} MARE{rows.length === 1 ? "" : "S"} · IN-USE FIRST BY
            DAYS-TO-FOAL
          </div>
        )}
      </div>
    </BreedersProChrome>
  );
}
