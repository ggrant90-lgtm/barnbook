"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Pregnancy } from "@/lib/types";
import { PREGNANCY_STATUS_LABELS } from "@/lib/horse-form-constants";
import { BreedersProChrome } from "@/components/breeders-pro/BreedersProChrome";

/* --------------------------------------------------------------------
 * Pregnancies list — Breeders Pro table-first view.
 *
 * Presentation only. Data comes in from the server page; no fetches,
 * no mutations.
 * ------------------------------------------------------------------ */

const STATUS_CLASS: Record<Pregnancy["status"], string> = {
  pending_check: "bp-status-frozen",
  confirmed: "bp-status-fresh",
  lost_early: "bp-status-lost",
  lost_late: "bp-status-lost",
  foaled: "bp-status-foal",
  aborted: "bp-status-lost",
};

type FilterId = "all" | "active" | "past" | "foaled" | "lost";

function fmtMonthDay(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString(undefined, { month: "short", day: "2-digit" });
}

function daysBetween(startIso: string, endIso: string | null): number | null {
  if (!endIso) return null;
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

function gestationDays(transferIso: string): number {
  const t = new Date(transferIso);
  if (Number.isNaN(t.getTime())) return 0;
  return Math.max(
    0,
    Math.floor((Date.now() - t.getTime()) / (1000 * 60 * 60 * 24)),
  );
}

export function PregnancyListClient({
  pregnancies,
  horseNames,
}: {
  pregnancies: Pregnancy[];
  horseNames: Record<string, string>;
}) {
  const [filter, setFilter] = useState<FilterId>("active");

  // ---------- Counts for filter chips ----------
  const counts = useMemo(() => {
    const c = { all: pregnancies.length, active: 0, past: 0, foaled: 0, lost: 0 };
    for (const p of pregnancies) {
      const isActive =
        p.status === "pending_check" || p.status === "confirmed";
      if (isActive) c.active++;
      else c.past++;
      if (p.status === "foaled") c.foaled++;
      if (
        p.status === "lost_early" ||
        p.status === "lost_late" ||
        p.status === "aborted"
      ) {
        c.lost++;
      }
    }
    return c;
  }, [pregnancies]);

  // ---------- Filtered rows ----------
  const rows = useMemo(() => {
    const filtered = pregnancies.filter((p) => {
      const isActive =
        p.status === "pending_check" || p.status === "confirmed";
      if (filter === "all") return true;
      if (filter === "active") return isActive;
      if (filter === "past") return !isActive;
      if (filter === "foaled") return p.status === "foaled";
      if (filter === "lost") {
        return (
          p.status === "lost_early" ||
          p.status === "lost_late" ||
          p.status === "aborted"
        );
      }
      return true;
    });

    // Active rows sort by days-to-foal ascending (most urgent first).
    // Everything else sorts by transfer date descending.
    return [...filtered].sort((a, b) => {
      if (filter === "active" || filter === "all") {
        const aDays = daysBetween(
          new Date().toISOString(),
          a.expected_foaling_date,
        );
        const bDays = daysBetween(
          new Date().toISOString(),
          b.expected_foaling_date,
        );
        if (aDays == null && bDays == null) return 0;
        if (aDays == null) return 1;
        if (bDays == null) return -1;
        return aDays - bDays;
      }
      return (
        new Date(b.transfer_date).getTime() -
        new Date(a.transfer_date).getTime()
      );
    });
  }, [pregnancies, filter]);

  const breadcrumb = [
    { label: "Breeders Pro", href: "/breeders-pro" },
    { label: "Pregnancies" },
  ];

  const lastUpdated = useMemo(() => {
    const t = new Date();
    return t
      .toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
      .toUpperCase();
  }, []);

  return (
    <BreedersProChrome breadcrumb={breadcrumb}>
      {/* ============== HEADER ============== */}
      <div className="bp-page-header">
        <div className="bp-page-title-row">
          <div>
            <h1 className="bp-page-title">Pregnancies</h1>
            <p className="bp-page-subtitle">
              Recipient-mare carriages in progress, with gestation tracking
              and pregnancy check timelines.
            </p>
          </div>
          <div className="bp-page-meta">
            UPDATED {lastUpdated} · {counts.active} ACTIVE
          </div>
        </div>
      </div>

      {/* ============== METRICS ============== */}
      <div
        className="bp-metrics"
        style={{ gridTemplateColumns: "repeat(5, 1fr)" }}
      >
        <div className="bp-metric">
          <div className="bp-metric-label">Active</div>
          <div className="bp-metric-value">{counts.active}</div>
          <div className="bp-metric-delta">in progress</div>
        </div>
        <div className="bp-metric">
          <div className="bp-metric-label">Foaled</div>
          <div className="bp-metric-value">{counts.foaled}</div>
          <div className="bp-metric-delta">to term</div>
        </div>
        <div className="bp-metric">
          <div className="bp-metric-label">Losses</div>
          <div className="bp-metric-value">{counts.lost}</div>
          <div className="bp-metric-delta">early + late</div>
        </div>
        <div className="bp-metric">
          <div className="bp-metric-label">Past</div>
          <div className="bp-metric-value">{counts.past}</div>
          <div className="bp-metric-delta">total history</div>
        </div>
        <div className="bp-metric">
          <div className="bp-metric-label">Total</div>
          <div className="bp-metric-value">{counts.all}</div>
          <div className="bp-metric-delta">all-time</div>
        </div>
      </div>

      {/* ============== TOOLBAR ============== */}
      <div className="bp-toolbar">
        <div className="bp-filters">
          {(
            [
              { id: "active", label: "Active", count: counts.active },
              { id: "past", label: "Past", count: counts.past },
              { id: "foaled", label: "Foaled", count: counts.foaled },
              { id: "lost", label: "Lost", count: counts.lost },
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
      </div>

      {/* ============== TABLE ============== */}
      <div className="bp-table-wrap">
        <div className="bp-table-container">
          {rows.length === 0 ? (
            <div className="bp-empty">
              No pregnancies match the current filter.
            </div>
          ) : (
            <table className="bp-table">
              <thead>
                <tr>
                  <th>Carrier</th>
                  <th>Donor</th>
                  <th>Sire</th>
                  <th>Method</th>
                  <th>Date</th>
                  <th style={{ textAlign: "right" }}>Day</th>
                  <th>Due</th>
                  <th style={{ textAlign: "right" }}>ETA</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const surrogateName =
                    horseNames[p.surrogate_horse_id] ?? "Unknown";
                  const donorName =
                    horseNames[p.donor_horse_id] ?? "Unknown";
                  const stallionName = p.stallion_horse_id
                    ? (horseNames[p.stallion_horse_id] ?? "Unknown")
                    : "—";
                  const gest = gestationDays(p.transfer_date);
                  const daysToFoal = daysBetween(
                    new Date().toISOString(),
                    p.expected_foaling_date,
                  );
                  const href = `/breeders-pro/pregnancy/${p.id}`;
                  return (
                    <tr
                      key={p.id}
                      onClick={() => (window.location.href = href)}
                    >
                      <td>
                        <Link
                          href={`/breeders-pro/surrogates/${p.surrogate_horse_id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="bp-donor-cell"
                          style={{ textDecoration: "none", color: "inherit" }}
                        >
                          <span className="bp-donor-name">
                            {surrogateName}
                          </span>
                        </Link>
                      </td>
                      <td>
                        <Link
                          href={`/breeders-pro/donors/${p.donor_horse_id}`}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            color: "var(--bp-ink)",
                            textDecoration: "none",
                          }}
                        >
                          {donorName}
                        </Link>
                      </td>
                      <td>
                        {p.stallion_horse_id ? (
                          <Link
                            href={`/breeders-pro/stallions/${p.stallion_horse_id}`}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              color: "var(--bp-ink)",
                              textDecoration: "none",
                            }}
                          >
                            {stallionName}
                          </Link>
                        ) : (
                          <span className="bp-empty-cell">—</span>
                        )}
                      </td>
                      <td>
                        <span
                          className="bp-mono"
                          style={{
                            fontSize: 9,
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                            color: "var(--bp-ink-tertiary)",
                          }}
                        >
                          {(p as any).conception_method === "live_cover"
                            ? "LC"
                            : (p as any).conception_method?.startsWith("ai_")
                              ? "AI"
                              : "ET"}
                        </span>
                      </td>
                      <td className="bp-mono">
                        {fmtMonthDay(p.transfer_date)}
                      </td>
                      <td
                        className="bp-mono"
                        style={{ textAlign: "right" }}
                      >
                        {gest}
                      </td>
                      <td className="bp-mono">
                        {fmtMonthDay(p.expected_foaling_date)}
                      </td>
                      <td
                        className="bp-mono"
                        style={{
                          textAlign: "right",
                          color:
                            daysToFoal != null && daysToFoal <= 14
                              ? "var(--bp-status-lost)"
                              : daysToFoal != null && daysToFoal <= 30
                                ? "var(--bp-status-transferred)"
                                : undefined,
                        }}
                      >
                        {daysToFoal == null
                          ? "—"
                          : daysToFoal < 0
                            ? `${-daysToFoal}d late`
                            : `${daysToFoal}d`}
                      </td>
                      <td>
                        <span className={`bp-status ${STATUS_CLASS[p.status]}`}>
                          <span className="bp-status-dot" />
                          {PREGNANCY_STATUS_LABELS[p.status]}
                        </span>
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
            {rows.length} PREGNANC{rows.length === 1 ? "Y" : "IES"} · SORTED BY{" "}
            {filter === "active" || filter === "all"
              ? "DAYS TO FOAL"
              : "TRANSFER DATE"}
          </div>
        )}
      </div>
    </BreedersProChrome>
  );
}
