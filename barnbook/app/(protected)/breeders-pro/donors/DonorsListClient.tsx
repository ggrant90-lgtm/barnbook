"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Flush, Horse } from "@/lib/types";
import { BreedersProChrome } from "@/components/breeders-pro/BreedersProChrome";

/* --------------------------------------------------------------------
 * Donor Mares — list view.
 *
 * Presentation only. Data comes in from the server page; client-side
 * aggregates compute last-flush and flush counts per donor.
 * ------------------------------------------------------------------ */

type DonorLite = Pick<
  Horse,
  | "id"
  | "name"
  | "registration_number"
  | "breed"
  | "color"
  | "breeding_role"
  | "reproductive_status"
  | "lifetime_embryo_count"
  | "lifetime_live_foal_count"
  | "archived"
>;

type FilterId = "active" | "archived" | "all";

const REPRO_LABEL: Record<string, string> = {
  open: "Open",
  in_cycle: "In Cycle",
  bred: "Bred",
  confirmed_pregnant: "Pregnant",
  foaling: "Foaling",
  post_foaling: "Post-Foal",
  retired: "Retired",
};

const REPRO_CLASS: Record<string, string> = {
  open: "bp-status-shipped",
  in_cycle: "bp-status-transferred",
  bred: "bp-status-frozen",
  confirmed_pregnant: "bp-status-fresh",
  foaling: "bp-status-fresh",
  post_foaling: "bp-status-foal",
  retired: "bp-status-shipped",
};

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

export function DonorsListClient({
  donors,
  flushes,
}: {
  donors: DonorLite[];
  flushes: Pick<Flush, "donor_horse_id" | "flush_date" | "embryo_count">[];
}) {
  const [filter, setFilter] = useState<FilterId>("active");
  const [query, setQuery] = useState("");

  // ---------- Rollups per donor ----------
  const rollups = useMemo(() => {
    const map = new Map<
      string,
      { flushCount: number; lastFlushDate: string | null }
    >();
    for (const f of flushes) {
      const entry = map.get(f.donor_horse_id) ?? {
        flushCount: 0,
        lastFlushDate: null,
      };
      entry.flushCount += 1;
      if (
        !entry.lastFlushDate ||
        new Date(f.flush_date).getTime() >
          new Date(entry.lastFlushDate).getTime()
      ) {
        entry.lastFlushDate = f.flush_date;
      }
      map.set(f.donor_horse_id, entry);
    }
    return map;
  }, [flushes]);

  // ---------- Counts for filter chips ----------
  const counts = useMemo(() => {
    const active = donors.filter((d) => !d.archived).length;
    const archived = donors.filter((d) => d.archived).length;
    return { active, archived, all: donors.length };
  }, [donors]);

  // ---------- Filtered + sorted rows ----------
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = donors.filter((d) => {
      if (filter === "active" && d.archived) return false;
      if (filter === "archived" && !d.archived) return false;
      if (q) {
        const hay = `${d.name} ${d.registration_number ?? ""} ${d.breed ?? ""}`
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    // Sort by most-recent flush date desc, then by name asc
    return [...filtered].sort((a, b) => {
      const la = rollups.get(a.id)?.lastFlushDate;
      const lb = rollups.get(b.id)?.lastFlushDate;
      if (la && lb) return new Date(lb).getTime() - new Date(la).getTime();
      if (la) return -1;
      if (lb) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [donors, filter, query, rollups]);

  // ---------- Summary metrics ----------
  const metrics = useMemo(() => {
    const totalEmbryos = donors.reduce(
      (sum, d) => sum + (d.lifetime_embryo_count ?? 0),
      0,
    );
    const totalFoals = donors.reduce(
      (sum, d) => sum + (d.lifetime_live_foal_count ?? 0),
      0,
    );
    return {
      count: donors.length,
      active: counts.active,
      totalEmbryos,
      totalFoals,
      totalFlushes: flushes.length,
    };
  }, [donors, flushes, counts.active]);

  const breadcrumb = [
    { label: "Breeders Pro", href: "/breeders-pro" },
    { label: "Donor Mares" },
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
            <h1 className="bp-page-title">Donor Mares</h1>
            <p className="bp-page-subtitle">
              Mares in the donor roster, their reproductive state, and
              lifetime program totals.
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
          <div className="bp-metric-label">Donors</div>
          <div className="bp-metric-value">{metrics.count}</div>
          <div className="bp-metric-delta">{metrics.active} active</div>
        </div>
        <div className="bp-metric">
          <div className="bp-metric-label">Lifetime Embryos</div>
          <div className="bp-metric-value">{metrics.totalEmbryos}</div>
          <div className="bp-metric-delta">across roster</div>
        </div>
        <div className="bp-metric">
          <div className="bp-metric-label">Lifetime Foals</div>
          <div className="bp-metric-value">{metrics.totalFoals}</div>
          <div className="bp-metric-delta">live, to term</div>
        </div>
        <div className="bp-metric">
          <div className="bp-metric-label">Total Flushes</div>
          <div className="bp-metric-value">{metrics.totalFlushes}</div>
          <div className="bp-metric-delta">all-time</div>
        </div>
        <div className="bp-metric">
          <div className="bp-metric-label">Avg Embryos / Donor</div>
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
              {donors.length === 0
                ? "No donor mares yet. Record a flush to start the roster."
                : "No donors match the current filter."}
            </div>
          ) : (
            <table className="bp-table">
              <thead>
                <tr>
                  <th>Mare</th>
                  <th>Breed</th>
                  <th>Repro</th>
                  <th style={{ textAlign: "right" }}>Embryos</th>
                  <th style={{ textAlign: "right" }}>Foals</th>
                  <th style={{ textAlign: "right" }}>Flushes</th>
                  <th>Last Flush</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => {
                  const r = rollups.get(d.id);
                  const href = `/breeders-pro/donors/${d.id}`;
                  const reproKey = d.reproductive_status ?? "open";
                  return (
                    <tr
                      key={d.id}
                      onClick={() => (window.location.href = href)}
                    >
                      <td>
                        <Link
                          href={href}
                          onClick={(e) => e.stopPropagation()}
                          className="bp-donor-cell"
                          style={{ textDecoration: "none", color: "inherit" }}
                        >
                          <span className="bp-donor-name">{d.name}</span>
                          {d.registration_number && (
                            <span className="bp-donor-reg">
                              {d.registration_number}
                            </span>
                          )}
                        </Link>
                      </td>
                      <td>
                        {d.breed || (
                          <span className="bp-empty-cell">—</span>
                        )}
                      </td>
                      <td>
                        {d.reproductive_status ? (
                          <span
                            className={`bp-status ${REPRO_CLASS[reproKey] ?? "bp-status-shipped"}`}
                          >
                            <span className="bp-status-dot" />
                            {REPRO_LABEL[reproKey] ?? reproKey}
                          </span>
                        ) : (
                          <span className="bp-empty-cell">—</span>
                        )}
                      </td>
                      <td
                        className="bp-mono"
                        style={{ textAlign: "right" }}
                      >
                        {d.lifetime_embryo_count ?? 0}
                      </td>
                      <td
                        className="bp-mono"
                        style={{ textAlign: "right" }}
                      >
                        {d.lifetime_live_foal_count ?? 0}
                      </td>
                      <td
                        className="bp-mono"
                        style={{ textAlign: "right" }}
                      >
                        {r?.flushCount ?? 0}
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
            {rows.length} MARE{rows.length === 1 ? "" : "S"} · SORTED BY
            MOST-RECENT FLUSH
          </div>
        )}
      </div>
    </BreedersProChrome>
  );
}
