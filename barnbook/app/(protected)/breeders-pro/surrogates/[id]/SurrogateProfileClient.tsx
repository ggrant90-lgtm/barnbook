"use client";

import Link from "next/link";
import { useMemo } from "react";
import type {
  Embryo,
  Foaling,
  Horse,
  HorseCurrentLocation,
  HorseLocationAssignment,
  Location,
  Pregnancy,
} from "@/lib/types";
import { BreedersProChrome } from "@/components/breeders-pro/BreedersProChrome";
import { HorseLifecycleActions } from "@/components/breeders-pro/HorseLifecycleActions";

/* --------------------------------------------------------------------
 * Surrogate Mare Profile — Breeders Pro trimmed view.
 *
 * Presentation only. Focus: availability, current carried pregnancy,
 * carrier history, and delivered foals. No photos, no care logs.
 * ------------------------------------------------------------------ */

const PREGNANCY_STATUS_LABEL: Record<Pregnancy["status"], string> = {
  pending_check: "Pending Check",
  confirmed: "Confirmed",
  lost_early: "Lost Early",
  lost_late: "Lost Late",
  foaled: "Foaled",
  aborted: "Aborted",
};

const PREGNANCY_STATUS_CLASS: Record<Pregnancy["status"], string> = {
  pending_check: "bp-status-frozen",
  confirmed: "bp-status-fresh",
  lost_early: "bp-status-lost",
  lost_late: "bp-status-lost",
  foaled: "bp-status-foal",
  aborted: "bp-status-lost",
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

function gestationDays(transferDateIso: string): number {
  const t = new Date(transferDateIso);
  if (Number.isNaN(t.getTime())) return 0;
  const diff = Date.now() - t.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

export function SurrogateProfileClient({
  horse,
  pregnancies,
  embryos,
  foalings,
  horseNames,
  canEdit,
  currentLocation,
  locationHistory,
  facilities,
  locationNames,
}: {
  horse: Horse;
  pregnancies: Pregnancy[];
  embryos: Embryo[];
  foalings: Foaling[];
  horseNames: Record<string, string>;
  canEdit: boolean;
  currentLocation: HorseCurrentLocation | null;
  locationHistory: HorseLocationAssignment[];
  facilities: Location[];
  locationNames: Record<string, string>;
}) {
  const embryoById = useMemo(() => {
    const m = new Map<string, Embryo>();
    for (const e of embryos) m.set(e.id, e);
    return m;
  }, [embryos]);

  // ---------- Current / most-recent active pregnancy ----------
  const currentPregnancy = useMemo(() => {
    return (
      pregnancies.find(
        (p) => p.status === "confirmed" || p.status === "pending_check",
      ) ?? null
    );
  }, [pregnancies]);

  // ---------- Availability ----------
  const isAvailable = currentPregnancy == null;
  const availabilityLabel = isAvailable ? "Available" : "In Use";
  const availabilityClass = isAvailable ? "bp-status-fresh" : "bp-status-frozen";

  // ---------- Metrics ----------
  const metrics = useMemo(() => {
    const total = pregnancies.length;
    const foaled = pregnancies.filter((p) => p.status === "foaled").length;
    const lost = pregnancies.filter(
      (p) =>
        p.status === "lost_early" ||
        p.status === "lost_late" ||
        p.status === "aborted",
    ).length;
    const successRate =
      total > 0 ? Math.round((foaled / total) * 100) : null;
    const liveFoals = foalings.filter(
      (f) => f.foal_alive_at_24hr !== false,
    ).length;
    return { total, foaled, lost, successRate, liveFoals };
  }, [pregnancies, foalings]);

  const breadcrumb = [
    { label: "Breeders Pro", href: "/breeders-pro" },
    { label: "Surrogate" },
    { label: horse.name },
  ];

  const roleTag =
    horse.breeding_role === "multiple" ? "Surrogate · Multi" : "Surrogate";

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
                {horse.recipient_herd_id && (
                  <div className="bp-attr">
                    <span className="bp-attr-label">Herd</span>
                    <span className="bp-mono">{horse.recipient_herd_id}</span>
                  </div>
                )}
                {currentLocation?.facility_name && (
                  <div className="bp-attr">
                    <span className="bp-attr-label">Location</span>
                    <span>
                      {currentLocation.facility_name}
                      {currentLocation.assignment_note && (
                        <span
                          style={{
                            color: "var(--bp-ink-tertiary)",
                            marginLeft: 6,
                          }}
                        >
                          · {currentLocation.assignment_note}
                        </span>
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div
            className="bp-profile-actions"
            style={{
              alignItems: "flex-end",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {horse.disposition && (
                <div className="bp-status bp-status-lost">
                  <span className="bp-status-dot" />
                  {horse.disposition === "sold"
                    ? "Sold"
                    : horse.disposition === "died"
                      ? "Deceased"
                      : "Retired"}
                </div>
              )}
              <div className={`bp-status ${availabilityClass}`}>
                <span className="bp-status-dot" />
                {availabilityLabel}
              </div>
            </div>
            {canEdit && (
              <HorseLifecycleActions
                horse={horse}
                activePregnancy={currentPregnancy}
                facilities={facilities}
              />
            )}
            {/* Breeding method shortcuts — any mare can be flushed or traditional-carry */}
            {canEdit && horse.sex === "mare" && (
              <div className="bp-method-group" role="group" aria-label="Breeding method">
                <Link
                  href="/breeders-pro/flush/new"
                  className="bp-btn bp-primary"
                  style={{ fontSize: 11, padding: "5px 10px" }}
                >
                  + Flush
                </Link>
                <Link
                  href="/breeders-pro/live-cover/new"
                  className="bp-btn bp-primary"
                  style={{ fontSize: 11, padding: "5px 10px" }}
                >
                  + Traditional Carry
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ============== METRICS ============== */}
      <div
        className="bp-metrics"
        style={{ gridTemplateColumns: "repeat(5, 1fr)" }}
      >
        <div className="bp-metric">
          <div className="bp-metric-label">Total Transfers</div>
          <div className="bp-metric-value">{metrics.total}</div>
          <div className="bp-metric-delta">carried</div>
        </div>
        <div className="bp-metric">
          <div className="bp-metric-label">Foaled</div>
          <div className="bp-metric-value">{metrics.foaled}</div>
          <div className="bp-metric-delta">to term</div>
        </div>
        <div className="bp-metric">
          <div className="bp-metric-label">Losses</div>
          <div className="bp-metric-value">{metrics.lost}</div>
          <div className="bp-metric-delta">early + late</div>
        </div>
        <div className="bp-metric">
          <div className="bp-metric-label">Success Rate</div>
          <div className="bp-metric-value">
            {metrics.successRate != null ? `${metrics.successRate}%` : "—"}
          </div>
          <div className="bp-metric-delta">foaled / total</div>
        </div>
        <div className="bp-metric">
          <div className="bp-metric-label">Live Foals</div>
          <div className="bp-metric-value">{metrics.liveFoals}</div>
          <div className="bp-metric-delta">alive at 24hr</div>
        </div>
      </div>

      {/* ============== CONTENT ============== */}
      <div className="bp-content">
        <div className="bp-content-main">
          {/* Current pregnancy card */}
          {currentPregnancy && (
            <div className="bp-side-section">
              <div className="bp-side-label">Current Pregnancy</div>
              <div className="bp-info-list" style={{ marginTop: 8 }}>
                <div className="bp-info-row">
                  <span className="bp-info-key">Status</span>
                  <span className="bp-info-value">
                    <span
                      className={`bp-status ${PREGNANCY_STATUS_CLASS[currentPregnancy.status]}`}
                    >
                      <span className="bp-status-dot" />
                      {PREGNANCY_STATUS_LABEL[currentPregnancy.status]}
                    </span>
                  </span>
                </div>
                <div className="bp-info-row">
                  <span className="bp-info-key">Transfer Date</span>
                  <span className="bp-info-value bp-mono">
                    {fmtIso(currentPregnancy.transfer_date)}
                  </span>
                </div>
                <div className="bp-info-row">
                  <span className="bp-info-key">Gestation</span>
                  <span className="bp-info-value bp-mono">
                    {gestationDays(currentPregnancy.transfer_date)} days
                  </span>
                </div>
                <div className="bp-info-row">
                  <span className="bp-info-key">Expected Foaling</span>
                  <span className="bp-info-value bp-mono">
                    {fmtIso(currentPregnancy.expected_foaling_date)}
                  </span>
                </div>
                <div className="bp-info-row">
                  <span className="bp-info-key">Donor Mare</span>
                  <span className="bp-info-value">
                    <Link
                      href={`/breeders-pro/donors/${currentPregnancy.donor_horse_id}`}
                      style={{
                        color: "var(--bp-ink)",
                        textDecoration: "none",
                        fontWeight: 500,
                      }}
                    >
                      {horseNames[currentPregnancy.donor_horse_id] ?? "—"}
                    </Link>
                  </span>
                </div>
                <div className="bp-info-row">
                  <span className="bp-info-key">Sire</span>
                  <span className="bp-info-value">
                    {currentPregnancy.stallion_horse_id
                      ? (horseNames[currentPregnancy.stallion_horse_id] ?? "—")
                      : "—"}
                  </span>
                </div>
                <div className="bp-info-row">
                  <span className="bp-info-key">Embryo</span>
                  <span className="bp-info-value">
                    {currentPregnancy.embryo_id ? (
                      <Link
                        href={`/breeders-pro/${currentPregnancy.embryo_id}`}
                        className="bp-code"
                        style={{ textDecoration: "none" }}
                      >
                        {embryoById.get(currentPregnancy.embryo_id)
                          ?.embryo_code ?? "—"}
                      </Link>
                    ) : (
                      <span className="bp-mono" style={{ fontSize: 10, color: "var(--bp-ink-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        Traditional Carry
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Carrier history table */}
          <div className="bp-side-section">
            <div className="bp-section-header">
              <div className="bp-section-title">Carrier History</div>
              <div className="bp-section-meta">
                {pregnancies.length} transfer
                {pregnancies.length === 1 ? "" : "s"}
              </div>
            </div>

            {pregnancies.length === 0 ? (
              <div className="bp-empty">
                No embryos transferred to this mare yet.
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
                      <th>Transfer</th>
                      <th>Embryo</th>
                      <th>Donor</th>
                      <th>Sire</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pregnancies.map((p) => {
                      const e = p.embryo_id ? embryoById.get(p.embryo_id) : null;
                      return (
                        <tr key={p.id}>
                          <td className="bp-mono">
                            {fmtMonthDay(p.transfer_date)}
                          </td>
                          <td>
                            {e ? (
                              <Link
                                href={`/breeders-pro/${e.id}`}
                                className="bp-code"
                                style={{ textDecoration: "none" }}
                              >
                                {e.embryo_code}
                              </Link>
                            ) : (
                              <span className="bp-empty-cell">—</span>
                            )}
                          </td>
                          <td>
                            <Link
                              href={`/breeders-pro/donors/${p.donor_horse_id}`}
                              style={{
                                color: "var(--bp-ink)",
                                textDecoration: "none",
                              }}
                            >
                              {horseNames[p.donor_horse_id] ?? "—"}
                            </Link>
                          </td>
                          <td>
                            {p.stallion_horse_id
                              ? (horseNames[p.stallion_horse_id] ?? "—")
                              : "—"}
                          </td>
                          <td>
                            <span
                              className={`bp-status ${PREGNANCY_STATUS_CLASS[p.status]}`}
                            >
                              <span className="bp-status-dot" />
                              {PREGNANCY_STATUS_LABEL[p.status]}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Location history */}
          {locationHistory.length > 0 && (
            <div className="bp-side-section">
              <div className="bp-section-header">
                <div className="bp-section-title">Location History</div>
                <div className="bp-section-meta">
                  {locationHistory.length} assignment
                  {locationHistory.length === 1 ? "" : "s"}
                </div>
              </div>
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
                      <th>Started</th>
                      <th>Ended</th>
                      <th>Facility</th>
                      <th>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {locationHistory.map((a) => (
                      <tr key={a.id}>
                        <td className="bp-mono">{fmtMonthDay(a.started_at)}</td>
                        <td className="bp-mono">
                          {a.ended_at ? (
                            fmtMonthDay(a.ended_at)
                          ) : (
                            <span
                              style={{
                                color: "var(--bp-accent)",
                                fontWeight: 500,
                              }}
                            >
                              CURRENT
                            </span>
                          )}
                        </td>
                        <td>
                          {locationNames[a.location_id] ?? (
                            <span className="bp-empty-cell">—</span>
                          )}
                        </td>
                        <td>
                          {a.note ? (
                            a.note
                          ) : (
                            <span className="bp-empty-cell">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Foaling history */}
          {foalings.length > 0 && (
            <div className="bp-side-section">
              <div className="bp-section-header">
                <div className="bp-section-title">Foalings Delivered</div>
                <div className="bp-section-meta">
                  {foalings.length} foaling
                  {foalings.length === 1 ? "" : "s"}
                </div>
              </div>
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
                      <th>Type</th>
                      <th>Sex</th>
                      <th>Color</th>
                      <th>24hr</th>
                    </tr>
                  </thead>
                  <tbody>
                    {foalings.map((f) => (
                      <tr key={f.id}>
                        <td className="bp-mono">
                          {fmtMonthDay(f.foaling_date)}
                        </td>
                        <td style={{ textTransform: "capitalize" }}>
                          {f.foaling_type.replace("_", " ")}
                        </td>
                        <td style={{ textTransform: "capitalize" }}>
                          {f.foal_sex}
                        </td>
                        <td>{f.foal_color || "—"}</td>
                        <td>
                          {f.foal_alive_at_24hr === true
                            ? "Alive"
                            : f.foal_alive_at_24hr === false
                              ? "Lost"
                              : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ============== SIDE PANEL ============== */}
        <aside className="bp-content-side">
          <div className="bp-side-section">
            <div className="bp-side-label">Availability</div>
            <div className="bp-info-list">
              <div className="bp-info-row">
                <span className="bp-info-key">Status</span>
                <span className="bp-info-value">{availabilityLabel}</span>
              </div>
              <div className="bp-info-row">
                <span className="bp-info-key">Repro State</span>
                <span className="bp-info-value">
                  {horse.reproductive_status
                    ? horse.reproductive_status.replace("_", " ")
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

          {horse.disposition && (
            <div className="bp-side-section">
              <div className="bp-side-label">Disposition</div>
              <div className="bp-info-list">
                <div className="bp-info-row">
                  <span className="bp-info-key">Outcome</span>
                  <span className="bp-info-value">
                    {horse.disposition === "sold"
                      ? "Sold"
                      : horse.disposition === "died"
                        ? "Deceased"
                        : "Retired"}
                  </span>
                </div>
                {horse.disposition_date && (
                  <div className="bp-info-row">
                    <span className="bp-info-key">Date</span>
                    <span className="bp-info-value bp-mono">
                      {fmtIso(horse.disposition_date)}
                    </span>
                  </div>
                )}
                {horse.disposition === "sold" && horse.disposition_sold_to && (
                  <div className="bp-info-row">
                    <span className="bp-info-key">Sold To</span>
                    <span className="bp-info-value">
                      {horse.disposition_sold_to}
                    </span>
                  </div>
                )}
                {horse.disposition === "sold" &&
                  horse.disposition_sale_price != null && (
                    <div className="bp-info-row">
                      <span className="bp-info-key">Price</span>
                      <span className="bp-info-value bp-mono">
                        ${horse.disposition_sale_price.toLocaleString()}
                      </span>
                    </div>
                  )}
                {horse.disposition_notes && (
                  <div className="bp-info-row">
                    <span className="bp-info-key">Notes</span>
                    <span className="bp-info-value">
                      {horse.disposition_notes}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="bp-side-section">
            <div className="bp-side-label">Lifetime</div>
            <div className="bp-info-list">
              <div className="bp-info-row">
                <span className="bp-info-key">Transfers</span>
                <span className="bp-info-value bp-mono">{metrics.total}</span>
              </div>
              <div className="bp-info-row">
                <span className="bp-info-key">Foaled</span>
                <span className="bp-info-value bp-mono">
                  {metrics.foaled}
                </span>
              </div>
              <div className="bp-info-row">
                <span className="bp-info-key">Losses</span>
                <span className="bp-info-value bp-mono">{metrics.lost}</span>
              </div>
              <div className="bp-info-row">
                <span className="bp-info-key">Success</span>
                <span className="bp-info-value bp-mono">
                  {metrics.successRate != null
                    ? `${metrics.successRate}%`
                    : "—"}
                </span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </BreedersProChrome>
  );
}
