"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Embryo, Flush, Horse } from "@/lib/types";
import { BreedersProChrome } from "@/components/breeders-pro/BreedersProChrome";

/* --------------------------------------------------------------------
 * Stallions — list view.
 *
 * Presentation only. Lifetime sire stats are computed client-side from
 * the embryos and flushes passed in by the server page.
 * ------------------------------------------------------------------ */

type StallionLite = Pick<
  Horse,
  | "id"
  | "name"
  | "registration_number"
  | "breed"
  | "color"
  | "breeding_role"
  | "stallion_stud_fee"
  | "archived"
>;

type FilterId = "active" | "archived" | "all";

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

export function StallionsListClient({
  stallions,
  embryos,
  flushes,
}: {
  stallions: StallionLite[];
  embryos: Pick<Embryo, "stallion_horse_id" | "status" | "donor_horse_id">[];
  flushes: Pick<Flush, "stallion_horse_id" | "flush_date" | "donor_horse_id">[];
}) {
  const [filter, setFilter] = useState<FilterId>("active");
  const [query, setQuery] = useState("");

  // ---------- Rollups per stallion ----------
  const rollups = useMemo(() => {
    const map = new Map<
      string,
      {
        embryoCount: number;
        foalCount: number;
        flushCount: number;
        lastFlushDate: string | null;
        uniqueDonors: Set<string>;
      }
    >();
    for (const s of stallions) {
      map.set(s.id, {
        embryoCount: 0,
        foalCount: 0,
        flushCount: 0,
        lastFlushDate: null,
        uniqueDonors: new Set<string>(),
      });
    }
    for (const e of embryos) {
      if (!e.stallion_horse_id) continue;
      const entry = map.get(e.stallion_horse_id);
      if (!entry) continue;
      entry.embryoCount += 1;
      if (e.status === "became_foal") entry.foalCount += 1;
    }
    for (const f of flushes) {
      if (!f.stallion_horse_id) continue;
      const entry = map.get(f.stallion_horse_id);
      if (!entry) continue;
      entry.flushCount += 1;
      if (f.donor_horse_id) entry.uniqueDonors.add(f.donor_horse_id);
      if (
        !entry.lastFlushDate ||
        new Date(f.flush_date).getTime() >
          new Date(entry.lastFlushDate).getTime()
      ) {
        entry.lastFlushDate = f.flush_date;
      }
    }
    return map;
  }, [stallions, embryos, flushes]);

  // ---------- Counts for filter chips ----------
  const counts = useMemo(() => {
    const active = stallions.filter((s) => !s.archived).length;
    const archived = stallions.filter((s) => s.archived).length;
    return { active, archived, all: stallions.length };
  }, [stallions]);

  // ---------- Filtered + sorted rows ----------
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = stallions.filter((s) => {
      if (filter === "active" && s.archived) return false;
      if (filter === "archived" && !s.archived) return false;
      if (q) {
        const hay = `${s.name} ${s.registration_number ?? ""} ${s.breed ?? ""}`
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    return [...filtered].sort((a, b) => {
      const la = rollups.get(a.id)?.lastFlushDate;
      const lb = rollups.get(b.id)?.lastFlushDate;
      if (la && lb) return new Date(lb).getTime() - new Date(la).getTime();
      if (la) return -1;
      if (lb) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [stallions, filter, query, rollups]);

  // ---------- Summary metrics ----------
  const metrics = useMemo(() => {
    let totalEmbryos = 0;
    let totalFoals = 0;
    for (const r of rollups.values()) {
      totalEmbryos += r.embryoCount;
      totalFoals += r.foalCount;
    }
    return {
      count: stallions.length,
      active: counts.active,
      totalEmbryos,
      totalFoals,
      totalFlushes: flushes.length,
    };
  }, [stallions, rollups, flushes, counts.active]);

  const breadcrumb = [
    { label: "Breeders Pro", href: "/breeders-pro" },
    { label: "Stallions" },
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
            <h1 className="bp-page-title">Stallions</h1>
            <p className="bp-page-subtitle">
              Barn stallions with lifetime siring totals and most-recent
              flush activity.
            </p>
          </div>
          <div className="bp-page-meta">
            UPDATED {lastUpdated} · {metrics.active} ACTIVE
          </div>
        </div>
      </div>

      <div
        className="bp-metrics"
        style={{ gridTemplateColumns: "repeat(5, 1fr)" }}
      >
        <div className="bp-metric">
          <div className="bp-metric-label">Stallions</div>
          <div className="bp-metric-value">{metrics.count}</div>
          <div className="bp-metric-delta">{metrics.active} active</div>
        </div>
        <div className="bp-metric">
          <div className="bp-metric-label">Embryos Sired</div>
          <div className="bp-metric-value">{metrics.totalEmbryos}</div>
          <div className="bp-metric-delta">lifetime</div>
        </div>
        <div className="bp-metric">
          <div className="bp-metric-label">Live Foals</div>
          <div className="bp-metric-value">{metrics.totalFoals}</div>
          <div className="bp-metric-delta">to term</div>
        </div>
        <div className="bp-metric">
          <div className="bp-metric-label">Flushes</div>
          <div className="bp-metric-value">{metrics.totalFlushes}</div>
          <div className="bp-metric-delta">as sire</div>
        </div>
        <div className="bp-metric">
          <div className="bp-metric-label">Avg Embryos / Stallion</div>
          <div className="bp-metric-value">
            {metrics.count > 0
              ? (metrics.totalEmbryos / metrics.count).toFixed(1)
              : "—"}
          </div>
          <div className="bp-metric-delta">lifetime</div>
        </div>
      </div>

      <div className="bp-toolbar">
        <div className="bp-filters">
          {(
            [
              { id: "active", label: "Active", count: counts.active },
              {
                id: "archived",
                label: "Archived",
                count: counts.archived,
              },
              { id: "all", label: "All", count: counts.all },
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
            placeholder="Search by name, registration, or breed…"
          />
        </div>
        <div className="bp-toolbar-actions">
          <Link href="/breeders-pro/flush/new" className="bp-btn bp-primary">
            + Record Flush
          </Link>
        </div>
      </div>

      <div className="bp-table-wrap">
        <div className="bp-table-container">
          {rows.length === 0 ? (
            <div className="bp-empty">
              {stallions.length === 0
                ? "No barn stallions yet. Record a flush to add one."
                : "No stallions match the current filter."}
            </div>
          ) : (
            <table className="bp-table">
              <thead>
                <tr>
                  <th>Stallion</th>
                  <th>Breed</th>
                  <th style={{ textAlign: "right" }}>Stud Fee</th>
                  <th style={{ textAlign: "right" }}>Embryos</th>
                  <th style={{ textAlign: "right" }}>Foals</th>
                  <th style={{ textAlign: "right" }}>Flushes</th>
                  <th style={{ textAlign: "right" }}>Donors</th>
                  <th>Last Flush</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => {
                  const r = rollups.get(s.id);
                  const href = `/breeders-pro/stallions/${s.id}`;
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
                        {s.breed || (
                          <span className="bp-empty-cell">—</span>
                        )}
                      </td>
                      <td
                        className="bp-mono"
                        style={{ textAlign: "right" }}
                      >
                        {s.stallion_stud_fee != null
                          ? `$${s.stallion_stud_fee.toLocaleString()}`
                          : "—"}
                      </td>
                      <td
                        className="bp-mono"
                        style={{ textAlign: "right" }}
                      >
                        {r?.embryoCount ?? 0}
                      </td>
                      <td
                        className="bp-mono"
                        style={{ textAlign: "right" }}
                      >
                        {r?.foalCount ?? 0}
                      </td>
                      <td
                        className="bp-mono"
                        style={{ textAlign: "right" }}
                      >
                        {r?.flushCount ?? 0}
                      </td>
                      <td
                        className="bp-mono"
                        style={{ textAlign: "right" }}
                      >
                        {r?.uniqueDonors.size ?? 0}
                      </td>
                      <td className="bp-mono">
                        {fmtMonthDay(r?.lastFlushDate)}
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
            {rows.length} STALLION{rows.length === 1 ? "" : "S"} · SORTED BY
            MOST-RECENT FLUSH
          </div>
        )}
      </div>
    </BreedersProChrome>
  );
}
