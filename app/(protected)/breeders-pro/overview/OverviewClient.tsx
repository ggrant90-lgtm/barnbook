"use client";

import Link from "next/link";
import { BreedersProChrome } from "@/components/breeders-pro/BreedersProChrome";
import { PREGNANCY_STATUS_LABELS } from "@/lib/horse-form-constants";
import type { Pregnancy } from "@/lib/types";

const breadcrumb = [
  { label: "Breeders Pro", href: "/breeders-pro" },
  { label: "Overview" },
];

const GESTATION_DAYS = 340;

const METHOD_LABELS: Record<string, string> = {
  embryo_transfer: "ET",
  live_cover: "Live Cover",
  ai_fresh: "AI Fresh",
  ai_cooled: "AI Cooled",
  ai_frozen: "AI Frozen",
};

const SUBTYPE_LABELS: Record<string, string> = {
  heat_detected: "Heat Detected",
  bred_ai: "Bred / AI",
  ultrasound: "Ultrasound",
  flush_embryo: "Flush / Embryo",
  embryo_transfer: "Embryo Transfer",
  foaling: "Foaling",
  custom: "Custom",
};

const SUBTYPE_COLORS: Record<string, string> = {
  heat_detected: "#f59e0b",
  bred_ai: "#22c55e",
  ultrasound: "#3b82f6",
  flush_embryo: "#a855f7",
  embryo_transfer: "#a855f7",
  foaling: "#ec4899",
  custom: "#c9a84c",
};

function fmtDate(iso?: string | null): string {
  if (!iso) return "\u2014";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function fmtDateFull(iso?: string | null): string {
  if (!iso) return "\u2014";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/** Which pregnancy checks are overdue based on days in gestation? */
function getOverdueChecks(p: Pregnancy, daysPregnant: number): string[] {
  const overdue: string[] = [];
  const checks: [string, number, string][] = [
    ["check_14_day", 14, "14-day"],
    ["check_30_day", 30, "30-day"],
    ["check_45_day", 45, "45-day"],
    ["check_60_day", 60, "60-day"],
    ["check_90_day", 90, "90-day"],
  ];
  for (const [field, threshold, label] of checks) {
    const val = (p as unknown as Record<string, unknown>)[field];
    if (daysPregnant >= threshold + 5 && (val === "pending" || !val)) {
      overdue.push(label);
    }
  }
  return overdue;
}

export function OverviewClient({
  metrics,
  pregnancies,
  maresInHeat,
  recentBreedLogs,
  horseNames,
}: {
  metrics: {
    activePregnancies: number;
    embryosInBank: number;
    donorCount: number;
    stallionCount: number;
    surrogateCount: number;
    foalsThisSeason: number;
  };
  pregnancies: Pregnancy[];
  maresInHeat: { id: string; name: string }[];
  recentBreedLogs: {
    id: string;
    horse_id: string;
    notes: string | null;
    details: Record<string, unknown> | null;
    performed_at: string | null;
    created_at: string;
  }[];
  horseNames: Record<string, string>;
}) {
  const today = new Date();

  return (
    <BreedersProChrome breadcrumb={breadcrumb}>
      <div className="bp-page-header">
        <h1 className="bp-display" style={{ fontSize: 32 }}>
          Overview
        </h1>
        <p style={{ color: "var(--bp-ink-secondary)", fontSize: 13, marginTop: 6 }}>
          Your breeding program at a glance.
        </p>
      </div>

      <div className="px-4 md:px-8 pb-12" style={{ maxWidth: 960 }}>
        {/* ════════ METRICS ROW ════════ */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 12,
            marginBottom: 32,
          }}
        >
          {[
            { label: "Active Pregnancies", value: metrics.activePregnancies, href: "/breeders-pro/pregnancies" },
            { label: "Embryos in Bank", value: metrics.embryosInBank, href: "/breeders-pro" },
            { label: "Donor Mares", value: metrics.donorCount, href: "/breeders-pro/donors" },
            { label: "Stallions", value: metrics.stallionCount, href: "/breeders-pro/stallions" },
            { label: "Foals This Season", value: metrics.foalsThisSeason, href: "/breeders-pro/foalings" },
          ].map((m) => (
            <Link
              key={m.label}
              href={m.href}
              style={{
                background: "var(--bp-bg-elevated)",
                border: "1px solid var(--bp-border)",
                borderRadius: 8,
                padding: "16px 14px",
                textDecoration: "none",
                color: "inherit",
                transition: "border-color 120ms",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--bp-accent)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--bp-border)"; }}
            >
              <div
                className="bp-mono"
                style={{ fontSize: 28, fontWeight: 600, color: "var(--bp-ink)", lineHeight: 1 }}
              >
                {m.value}
              </div>
              <div style={{ fontSize: 11, color: "var(--bp-ink-tertiary)", marginTop: 6 }}>
                {m.label}
              </div>
            </Link>
          ))}
        </div>

        {/* ════════ MARES IN HEAT ALERT ════════ */}
        {maresInHeat.length > 0 && (
          <div
            style={{
              background: "#fef3c7",
              border: "1px solid #f59e0b",
              borderRadius: 8,
              padding: "12px 16px",
              marginBottom: 24,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span style={{ fontSize: 18 }}>{"\u26a0\ufe0f"}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#92400e" }}>
                {maresInHeat.length} mare{maresInHeat.length > 1 ? "s" : ""} in heat
              </div>
              <div style={{ fontSize: 12, color: "#a16207" }}>
                {maresInHeat.map((m, i) => (
                  <span key={m.id}>
                    {i > 0 && ", "}
                    <Link
                      href={`/breeders-pro/donors/${m.id}`}
                      style={{ color: "#92400e", textDecoration: "underline" }}
                    >
                      {m.name}
                    </Link>
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ════════ ACTIVE PREGNANCIES ════════ */}
        <div style={{ marginBottom: 32 }}>
          <h2
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "var(--bp-ink)",
              marginBottom: 12,
            }}
          >
            Active Pregnancies
          </h2>

          {pregnancies.length === 0 ? (
            <div
              style={{
                background: "var(--bp-bg-elevated)",
                border: "1px solid var(--bp-border)",
                borderRadius: 8,
                padding: "32px 16px",
                textAlign: "center",
                color: "var(--bp-ink-tertiary)",
                fontSize: 13,
              }}
            >
              No active pregnancies. Record a breeding event to get started.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {pregnancies.map((p) => {
                const transferDate = new Date(p.transfer_date);
                const daysPregnant = Math.round(
                  (today.getTime() - transferDate.getTime()) / (1000 * 60 * 60 * 24),
                );
                const daysToGo = GESTATION_DAYS - daysPregnant;
                const progress = Math.min(Math.max(daysPregnant / GESTATION_DAYS, 0), 1);
                const overdueChecks = getOverdueChecks(p, daysPregnant);
                const isPastDue = daysToGo < 0;

                // Color: green for confirmed, amber for pending/overdue, red for past due
                let barColor = "#22c55e"; // green
                if (isPastDue) {
                  barColor = "#ef4444"; // red
                } else if (p.status === "pending_check" || overdueChecks.length > 0) {
                  barColor = "#f59e0b"; // amber
                }

                const donorName = horseNames[p.donor_horse_id] ?? "Unknown";
                const stallionName = p.stallion_horse_id
                  ? (horseNames[p.stallion_horse_id] ?? "Unknown")
                  : "Unknown";

                return (
                  <Link
                    key={p.id}
                    href={`/breeders-pro/pregnancy/${p.id}`}
                    style={{
                      background: "var(--bp-bg-elevated)",
                      border: "1px solid var(--bp-border)",
                      borderRadius: 8,
                      padding: "14px 16px",
                      textDecoration: "none",
                      color: "inherit",
                      transition: "border-color 120ms, box-shadow 120ms",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = barColor;
                      e.currentTarget.style.boxShadow = `0 2px 8px ${barColor}20`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "var(--bp-border)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    {/* Header row */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 8,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--bp-ink)" }}>
                          {donorName} × {stallionName}
                        </span>
                        <span
                          className="bp-mono"
                          style={{
                            fontSize: 9,
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                            color: "var(--bp-ink-tertiary)",
                            background: "var(--bp-bg)",
                            padding: "2px 6px",
                            borderRadius: 4,
                          }}
                        >
                          {METHOD_LABELS[p.conception_method] ?? p.conception_method}
                        </span>
                      </div>
                      <span
                        className="bp-mono"
                        style={{
                          fontSize: 10,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          color: barColor,
                          fontWeight: 500,
                        }}
                      >
                        {PREGNANCY_STATUS_LABELS[p.status] ?? p.status}
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div
                      style={{
                        background: "var(--bp-bg)",
                        borderRadius: 6,
                        height: 10,
                        overflow: "hidden",
                        marginBottom: 6,
                      }}
                    >
                      <div
                        style={{
                          width: `${progress * 100}%`,
                          height: "100%",
                          background: barColor,
                          borderRadius: 6,
                          transition: "width 300ms ease",
                        }}
                      />
                    </div>

                    {/* Info row */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: 11,
                        color: "var(--bp-ink-secondary)",
                      }}
                    >
                      <span className="bp-mono">
                        Day {daysPregnant} of {GESTATION_DAYS}
                        {" \u00b7 "}
                        {isPastDue
                          ? `${Math.abs(daysToGo)} days past due`
                          : `${daysToGo} days to go`}
                      </span>
                      <span>
                        Due {fmtDateFull(p.expected_foaling_date)}
                      </span>
                    </div>

                    {/* Overdue check warnings */}
                    {overdueChecks.length > 0 && (
                      <div
                        style={{
                          marginTop: 6,
                          fontSize: 11,
                          color: "#92400e",
                          background: "#fef3c7",
                          borderRadius: 4,
                          padding: "4px 8px",
                          display: "inline-block",
                        }}
                      >
                        {"\u26a0\ufe0f"} {overdueChecks.join(", ")} check{overdueChecks.length > 1 ? "s" : ""} overdue
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* ════════ RECENT BREEDING ACTIVITY ════════ */}
        <div>
          <h2
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "var(--bp-ink)",
              marginBottom: 12,
            }}
          >
            Recent Breeding Activity
          </h2>

          {recentBreedLogs.length === 0 ? (
            <div
              style={{
                background: "var(--bp-bg-elevated)",
                border: "1px solid var(--bp-border)",
                borderRadius: 8,
                padding: "24px 16px",
                textAlign: "center",
                color: "var(--bp-ink-tertiary)",
                fontSize: 13,
              }}
            >
              No breeding activity recorded yet.
            </div>
          ) : (
            <div
              style={{
                background: "var(--bp-bg-elevated)",
                border: "1px solid var(--bp-border)",
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              {recentBreedLogs.map((log, i) => {
                const details = (log.details ?? {}) as Record<string, string>;
                const subtype = details.breed_subtype ?? "custom";
                const horseName = horseNames[log.horse_id] ?? "Unknown";
                const logDate = log.performed_at || log.created_at;

                return (
                  <Link
                    key={log.id}
                    href={`/horses/${log.horse_id}?tab=breeding`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 16px",
                      textDecoration: "none",
                      color: "inherit",
                      borderBottom: i < recentBreedLogs.length - 1 ? "1px solid var(--bp-border)" : "none",
                      transition: "background 80ms",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bp-bg)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: SUBTYPE_COLORS[subtype] ?? "#c9a84c",
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 500,
                        color: SUBTYPE_COLORS[subtype] ?? "#c9a84c",
                        minWidth: 90,
                      }}
                    >
                      {SUBTYPE_LABELS[subtype] ?? subtype}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "var(--bp-ink)" }}>
                      {horseName}
                    </span>
                    {log.notes && (
                      <span
                        style={{
                          fontSize: 12,
                          color: "var(--bp-ink-tertiary)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          flex: 1,
                        }}
                      >
                        {log.notes}
                      </span>
                    )}
                    <span
                      className="bp-mono"
                      style={{ fontSize: 10, color: "var(--bp-ink-quaternary)", flexShrink: 0 }}
                    >
                      {fmtDate(logDate)}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </BreedersProChrome>
  );
}
