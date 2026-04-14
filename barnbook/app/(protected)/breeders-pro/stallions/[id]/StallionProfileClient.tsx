"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Embryo, Flush, Horse, Pregnancy } from "@/lib/types";
import type { EmbryoLocation } from "@/lib/embryo-location";
import { BreedersProChrome } from "@/components/breeders-pro/BreedersProChrome";

type EmbryoFilterKind =
  | "all"
  | "fresh"
  | "frozen"
  | "transferred"
  | "foaled"
  | "lost"
  | "shipped";

/* --------------------------------------------------------------------
 * Stallion Profile — Breeders Pro trimmed view.
 *
 * Presentation only. No photos, logs, care notes, or BarnBook-style
 * narrative sections. The screen is a clinical data-organization view:
 * identifiers, program role metadata, and tabular breeding history.
 * ------------------------------------------------------------------ */

const STATUS_SHORT: Record<Embryo["status"], string> = {
  in_bank_fresh: "Fresh",
  in_bank_frozen: "Frozen",
  transferred: "Transferred",
  became_foal: "Foaled",
  shipped_out: "Shipped",
  lost: "Lost",
};

const STATUS_CLASS: Record<Embryo["status"], string> = {
  in_bank_fresh: "bp-status-fresh",
  in_bank_frozen: "bp-status-frozen",
  transferred: "bp-status-transferred",
  became_foal: "bp-status-foal",
  shipped_out: "bp-status-shipped",
  lost: "bp-status-lost",
};

const METHOD_SHORT: Record<Flush["breeding_method"], string> = {
  ai_fresh: "AI Fresh",
  ai_cooled: "AI Cooled",
  ai_frozen: "AI Frozen",
  live_cover: "Traditional Carry",
};

function fmtIso(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function fmtMonthDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString(undefined, { month: "short", day: "2-digit" });
}

export function StallionProfileClient({
  horse,
  flushes,
  embryos,
  pregnancies,
  embryoLocations,
  horseNames,
  canEdit,
}: {
  horse: Horse;
  flushes: Flush[];
  embryos: Embryo[];
  pregnancies: Pregnancy[];
  embryoLocations: Record<string, EmbryoLocation>;
  horseNames: Record<string, string>;
  canEdit: boolean;
}) {
  const [embryoFilter, setEmbryoFilter] = useState<EmbryoFilterKind>("all");
  // ---------- Derived metrics ----------
  const metrics = useMemo(() => {
    const totalEmbryos = embryos.length;
    const freshCount = embryos.filter(
      (e) => e.status === "in_bank_fresh",
    ).length;
    const frozenCount = embryos.filter(
      (e) => e.status === "in_bank_frozen",
    ).length;
    const transferredCount = embryos.filter(
      (e) => e.status === "transferred",
    ).length;
    const foaledCount = embryos.filter(
      (e) => e.status === "became_foal",
    ).length;
    const lostCount = embryos.filter((e) => e.status === "lost").length;

    const uniqueDonors = new Set(
      flushes.map((f) => f.donor_horse_id).filter(Boolean),
    ).size;

    const activePregnancies = pregnancies.filter(
      (p) => p.status === "confirmed" || p.status === "pending_check",
    ).length;

    return {
      totalEmbryos,
      freshCount,
      frozenCount,
      transferredCount,
      foaledCount,
      lostCount,
      uniqueDonors,
      activePregnancies,
      flushes: flushes.length,
    };
  }, [embryos, flushes, pregnancies]);

  // ---------- Top donor crosses (by embryo count) ----------
  const topCrosses = useMemo(() => {
    const counts = new Map<
      string,
      { name: string; embryos: number; foals: number }
    >();
    for (const e of embryos) {
      const key = e.donor_horse_id ?? "unknown";
      const name = horseNames[e.donor_horse_id] ?? "Unknown mare";
      const entry = counts.get(key) ?? { name, embryos: 0, foals: 0 };
      entry.embryos += 1;
      if (e.status === "became_foal") entry.foals += 1;
      counts.set(key, entry);
    }
    return [...counts.values()]
      .sort((a, b) => b.embryos - a.embryos)
      .slice(0, 5);
  }, [embryos, horseNames]);

  const breadcrumb = [
    { label: "Breeders Pro", href: "/breeders-pro" },
    { label: "Stallion" },
    { label: horse.name },
  ];

  const roleTag =
    horse.breeding_role === "multiple" ? "Stallion · Multi" : "Stallion";

  return (
    <BreedersProChrome breadcrumb={breadcrumb}>
      {/* ============== HEADER ============== */}
      <div className="bp-profile-header">
        <div className="bp-profile-top">
          <div className="bp-profile-identity">
            <div className="bp-profile-meta">
              <div className="bp-role-tag">{roleTag}</div>
              <h1 className="bp-profile-name">{horse.name}</h1>
              <div className="bp-profile-attributes">
                {horse.registration_number && (
                  <div className="bp-attr">
                    <span className="bp-attr-label">Reg</span>
                    <span>{horse.registration_number}</span>
                  </div>
                )}
                {horse.foal_date && (
                  <div className="bp-attr">
                    <span className="bp-attr-label">Foaled</span>
                    <span>{fmtIso(horse.foal_date)}</span>
                  </div>
                )}
                {horse.breed && (
                  <div className="bp-attr">
                    <span className="bp-attr-label">Breed</span>
                    <span>{horse.breed}</span>
                  </div>
                )}
                {horse.color && (
                  <div className="bp-attr">
                    <span className="bp-attr-label">Color</span>
                    <span>{horse.color}</span>
                  </div>
                )}
                {horse.stallion_stud_fee != null && (
                  <div className="bp-attr">
                    <span className="bp-attr-label">Stud Fee</span>
                    <span className="bp-mono">
                      ${horse.stallion_stud_fee.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* Breeding method action bar — stallion perspective.
              Stallions do not flush (flushes originate on the mare side).
              Semen Collection and Traditional Carry are the two stallion
              workflows — both placeholders for now. To initiate a flush
              with this stallion as sire, start from the donor mare's
              profile or the Embryo Bank toolbar. */}
          <div className="bp-profile-actions">
            {canEdit && (
              <div className="bp-method-group" role="group" aria-label="Breeding method">
                <button
                  type="button"
                  className="bp-btn"
                  disabled
                  title="Coming soon — semen collection and cryo storage log"
                  aria-disabled="true"
                >
                  Semen Collection
                  <span className="bp-method-soon">soon</span>
                </button>
                <button
                  type="button"
                  className="bp-btn"
                  disabled
                  title="Coming soon — traditional carry breeding"
                  aria-disabled="true"
                >
                  Traditional Carry
                  <span className="bp-method-soon">soon</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ============== METRICS ============== */}
      <div
        className="bp-metrics"
        style={{ gridTemplateColumns: "repeat(6, 1fr)" }}
      >
        <div className="bp-metric">
          <div className="bp-metric-label">Lifetime Embryos</div>
          <div className="bp-metric-value">{metrics.totalEmbryos}</div>
          <div className="bp-metric-delta">
            across {metrics.uniqueDonors} donor
            {metrics.uniqueDonors === 1 ? "" : "s"}
          </div>
        </div>
        <div className="bp-metric">
          <div className="bp-metric-label">Flushes</div>
          <div className="bp-metric-value">{metrics.flushes}</div>
          <div className="bp-metric-delta">as sire</div>
        </div>
        <div className="bp-metric">
          <div className="bp-metric-label">In Bank</div>
          <div className="bp-metric-value">
            {metrics.freshCount + metrics.frozenCount}
          </div>
          <div className="bp-metric-delta">
            {metrics.freshCount} fresh · {metrics.frozenCount} frozen
          </div>
        </div>
        <div className="bp-metric">
          <div className="bp-metric-label">Transferred</div>
          <div className="bp-metric-value">{metrics.transferredCount}</div>
          <div className="bp-metric-delta">embryos placed</div>
        </div>
        <div className="bp-metric">
          <div className="bp-metric-label">Live Foals</div>
          <div className="bp-metric-value">{metrics.foaledCount}</div>
          <div className="bp-metric-delta">sired to term</div>
        </div>
        <div className="bp-metric">
          <div className="bp-metric-label">Active Pregnancies</div>
          <div className="bp-metric-value">{metrics.activePregnancies}</div>
          <div className="bp-metric-delta">in progress</div>
        </div>
      </div>

      {/* ============== CONTENT ============== */}
      <div className="bp-content">
        <div className="bp-content-main">
          {/* Flush history as sire */}
          <div className="bp-side-section">
            <div className="bp-section-header">
              <div className="bp-section-title">Sire History</div>
              <div className="bp-section-meta">
                {flushes.length} flush{flushes.length === 1 ? "" : "es"}
              </div>
            </div>

            {flushes.length === 0 ? (
              <div className="bp-empty">
                No flushes yet with this stallion as sire.
              </div>
            ) : (
              <div
                style={{
                  marginTop: 12,
                  border: "1px solid var(--bp-border)",
                  borderRadius: 4,
                  overflow: "hidden",
                }}
              >
                <table className="bp-table" style={{ marginBottom: 0 }}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Donor Mare</th>
                      <th>Method</th>
                      <th style={{ textAlign: "right" }}>Embryos</th>
                      <th style={{ textAlign: "right" }}>Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flushes.map((f) => {
                      const donorName =
                        horseNames[f.donor_horse_id] ?? "Unknown";
                      return (
                        <tr key={f.id}>
                          <td className="bp-mono">
                            {fmtMonthDay(f.flush_date)}
                          </td>
                          <td>
                            <Link
                              href={`/breeders-pro/donors/${f.donor_horse_id}`}
                              style={{
                                color: "var(--bp-ink)",
                                textDecoration: "none",
                                fontWeight: 500,
                              }}
                            >
                              {donorName}
                            </Link>
                          </td>
                          <td>{METHOD_SHORT[f.breeding_method]}</td>
                          <td
                            className="bp-mono"
                            style={{ textAlign: "right" }}
                          >
                            {f.embryo_count}
                          </td>
                          <td
                            className="bp-mono"
                            style={{ textAlign: "right" }}
                          >
                            {f.flush_cost != null
                              ? `$${f.flush_cost.toLocaleString()}`
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Sired embryos — full table with filter chips + Location column */}
          <StallionSiredEmbryos
            embryos={embryos}
            embryoLocations={embryoLocations}
            horseNames={horseNames}
            filter={embryoFilter}
            onFilter={setEmbryoFilter}
          />
        </div>

        {/* ============== SIDE PANEL ============== */}
        <aside className="bp-content-side">
          <div className="bp-side-section">
            <div className="bp-side-label">Program Role</div>
            <div className="bp-info-list">
              <div className="bp-info-row">
                <span className="bp-info-key">Role</span>
                <span className="bp-info-value">{roleTag}</span>
              </div>
              <div className="bp-info-row">
                <span className="bp-info-key">Stud Fee</span>
                <span className="bp-info-value bp-mono">
                  {horse.stallion_stud_fee != null
                    ? `$${horse.stallion_stud_fee.toLocaleString()}`
                    : "—"}
                </span>
              </div>
              <div className="bp-info-row">
                <span className="bp-info-key">Archived</span>
                <span className="bp-info-value">
                  {horse.archived ? "Yes" : "No"}
                </span>
              </div>
            </div>
          </div>

          <div className="bp-side-section">
            <div className="bp-side-label">Top Donor Crosses</div>
            {topCrosses.length === 0 ? (
              <div
                style={{
                  fontSize: 11,
                  color: "var(--bp-ink-quaternary)",
                  fontFamily: "var(--bp-font-mono)",
                }}
              >
                No crosses recorded
              </div>
            ) : (
              <div className="bp-info-list">
                {topCrosses.map((c) => (
                  <div key={c.name} className="bp-info-row">
                    <span
                      className="bp-info-key"
                      style={{
                        textTransform: "none",
                        fontSize: 11,
                        color: "var(--bp-ink)",
                        fontWeight: 500,
                      }}
                    >
                      {c.name}
                    </span>
                    <span className="bp-info-value bp-mono">
                      {c.embryos} emb · {c.foals} foal
                      {c.foals === 1 ? "" : "s"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bp-side-section">
            <div className="bp-side-label">Lifetime</div>
            <div className="bp-info-list">
              <div className="bp-info-row">
                <span className="bp-info-key">Sired Embryos</span>
                <span className="bp-info-value bp-mono">
                  {metrics.totalEmbryos}
                </span>
              </div>
              <div className="bp-info-row">
                <span className="bp-info-key">Live Foals</span>
                <span className="bp-info-value bp-mono">
                  {metrics.foaledCount}
                </span>
              </div>
              <div className="bp-info-row">
                <span className="bp-info-key">Flushes</span>
                <span className="bp-info-value bp-mono">
                  {metrics.flushes}
                </span>
              </div>
              <div className="bp-info-row">
                <span className="bp-info-key">Unique Donors</span>
                <span className="bp-info-value bp-mono">
                  {metrics.uniqueDonors}
                </span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </BreedersProChrome>
  );
}

/* ============================================================
 * StallionSiredEmbryos — "All Embryos Sired" drill-down table.
 *
 * Lives in the main content column of the stallion profile,
 * below the Program Summary / Top Crosses side panel data.
 * Mirrors the donor profile's embryos tab: filter chips above,
 * data table below, row click → Embryo Detail, Location cell
 * click → surrogate or foal profile (stopPropagation so the row
 * navigation doesn't fire).
 *
 * Mobile: bp-filters wraps; bp-table scrolls horizontally via
 * globals.css mobile media query.
 * ============================================================ */
function StallionSiredEmbryos({
  embryos,
  embryoLocations,
  horseNames,
  filter,
  onFilter,
}: {
  embryos: Embryo[];
  embryoLocations: Record<string, EmbryoLocation>;
  horseNames: Record<string, string>;
  filter: EmbryoFilterKind;
  onFilter: (k: EmbryoFilterKind) => void;
}) {
  const counts = useMemo(() => {
    const c: Record<EmbryoFilterKind, number> = {
      all: embryos.length,
      fresh: 0,
      frozen: 0,
      transferred: 0,
      foaled: 0,
      lost: 0,
      shipped: 0,
    };
    for (const e of embryos) {
      const loc = embryoLocations[e.id];
      if (!loc) continue;
      if (loc.kind === "fresh") c.fresh++;
      else if (loc.kind === "frozen") c.frozen++;
      else if (loc.kind === "transferred") c.transferred++;
      else if (loc.kind === "foaled") c.foaled++;
      else if (loc.kind === "lost_pre" || loc.kind === "lost_post") c.lost++;
      else if (loc.kind === "shipped") c.shipped++;
    }
    return c;
  }, [embryos, embryoLocations]);

  const filtered = useMemo(() => {
    if (filter === "all") return embryos;
    return embryos.filter((e) => {
      const loc = embryoLocations[e.id];
      if (!loc) return false;
      if (filter === "lost")
        return loc.kind === "lost_pre" || loc.kind === "lost_post";
      return loc.kind === filter;
    });
  }, [embryos, embryoLocations, filter]);

  if (embryos.length === 0) {
    return (
      <div className="bp-side-section">
        <div className="bp-section-header">
          <div className="bp-section-title">Sired Embryos</div>
        </div>
        <div className="bp-empty">No embryos sired yet.</div>
      </div>
    );
  }

  const chips: { key: EmbryoFilterKind; label: string }[] = [
    { key: "all", label: "All" },
    { key: "fresh", label: "Fresh" },
    { key: "frozen", label: "Frozen" },
    { key: "transferred", label: "Transferred" },
    { key: "foaled", label: "Foaled" },
    { key: "lost", label: "Lost" },
    { key: "shipped", label: "Shipped" },
  ];

  return (
    <div className="bp-side-section">
      <div className="bp-section-header">
        <div className="bp-section-title">Sired Embryos</div>
        <div className="bp-section-meta">{embryos.length} total</div>
      </div>

      <div className="bp-filters" style={{ marginTop: 12, marginBottom: 12 }}>
        {chips.map((c) => (
          <button
            key={c.key}
            type="button"
            className={`bp-chip ${filter === c.key ? "bp-active" : ""}`}
            onClick={() => onFilter(c.key)}
            disabled={counts[c.key] === 0 && c.key !== "all"}
          >
            {c.label}
            <span className="bp-chip-count">{counts[c.key]}</span>
          </button>
        ))}
      </div>

      <div className="bp-table-wrap">
        <table className="bp-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Donor</th>
              <th>Created</th>
              <th>Status</th>
              <th>Current Location</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => {
              const loc = embryoLocations[e.id];
              return (
                <tr
                  key={e.id}
                  className="bp-row-link"
                  onClick={() => {
                    window.location.href = `/breeders-pro/${e.id}`;
                  }}
                >
                  <td className="bp-mono">{e.embryo_code}</td>
                  <td>
                    <Link
                      href={`/breeders-pro/donors/${e.donor_horse_id}`}
                      style={{
                        color: "var(--bp-ink)",
                        textDecoration: "none",
                      }}
                      onClick={(ev) => ev.stopPropagation()}
                    >
                      {horseNames[e.donor_horse_id] ?? "Unknown"}
                    </Link>
                  </td>
                  <td className="bp-mono">{fmtMonthDay(e.created_at)}</td>
                  <td>
                    <span className={`bp-status ${STATUS_CLASS[e.status]}`}>
                      <span className="bp-status-dot" />
                      {STATUS_SHORT[e.status]}
                    </span>
                  </td>
                  <td>
                    {loc ? (
                      loc.href ? (
                        <Link
                          href={loc.href}
                          className={`bp-location-cell${
                            loc.muted ? " bp-location-muted" : ""
                          }`}
                          onClick={(ev) => ev.stopPropagation()}
                        >
                          {loc.short}
                        </Link>
                      ) : (
                        <span
                          className={`bp-location-cell${
                            loc.muted ? " bp-location-muted" : ""
                          }`}
                        >
                          {loc.short}
                        </span>
                      )
                    ) : (
                      <span className="bp-location-cell bp-location-muted">
                        —
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
