"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BreedersProChrome } from "@/components/breeders-pro/BreedersProChrome";
import { recordICSIResultsAction } from "@/app/(protected)/actions/opu";

/* --------------------------------------------------------------------
 * ICSI Batch Detail — shows a batch's oocytes with their outcomes.
 *
 * If the batch status is not yet 'complete', an inline "Record Results"
 * form lets you mark each oocyte as developed (with grade/stage) or
 * failed (with reason). Submitting calls the record_icsi_results RPC
 * which atomically creates embryo rows for developed oocytes.
 * ------------------------------------------------------------------ */

const GRADE_OPTIONS = [
  { value: "grade_1", label: "Grade 1" },
  { value: "grade_2", label: "Grade 2" },
  { value: "grade_3", label: "Grade 3" },
  { value: "grade_4", label: "Grade 4" },
  { value: "degenerate", label: "Degenerate" },
];

const STAGE_OPTIONS = [
  { value: "morula", label: "Morula" },
  { value: "early_blastocyst", label: "Early Blastocyst" },
  { value: "blastocyst", label: "Blastocyst" },
  { value: "expanded_blastocyst", label: "Expanded Blastocyst" },
  { value: "hatched_blastocyst", label: "Hatched Blastocyst" },
];

const FAILURE_OPTIONS = [
  { value: "immature", label: "Immature" },
  { value: "failed_fertilization", label: "Failed Fertilization" },
  { value: "arrested", label: "Arrested Development" },
  { value: "degenerated", label: "Degenerated" },
  { value: "other", label: "Other" },
];

const STATUS_LABEL: Record<string, string> = {
  recovered: "Recovered",
  shipped: "Shipped",
  at_lab: "At Lab",
  injected: "Injected",
  developed: "Developed",
  failed: "Failed",
};

const STATUS_CLASS: Record<string, string> = {
  recovered: "bp-status-fresh",
  shipped: "bp-status-transferred",
  at_lab: "bp-status-frozen",
  injected: "bp-status-frozen",
  developed: "bp-status-foal",
  failed: "bp-status-lost",
};

const BATCH_STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  shipped: "Shipped to Lab",
  at_lab: "At Lab",
  processing: "Processing",
  results_ready: "Results Ready",
  complete: "Complete",
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

type OocyteResult = {
  oocyte_id: string;
  outcome: "developed" | "failed" | "";
  failure_reason: string;
  grade: string;
  stage: string;
};

export function ICSIBatchDetailClient({
  batch,
  oocytes,
  opuSessionId,
  donorHorseId,
  horseNames,
  labName,
  embryoCodes,
  canEdit,
}: {
  batch: {
    id: string;
    barn_id: string;
    opu_session_id: string;
    stallion_horse_id: string;
    lab_id: string | null;
    semen_type: string | null;
    shipped_date: string | null;
    received_date: string | null;
    icsi_date: string | null;
    results_date: string | null;
    ship_tracking_to_lab: string | null;
    ship_tracking_from_lab: string | null;
    lab_report_notes: string | null;
    cost: number | null;
    shipping_cost: number | null;
    status: string;
    notes: string | null;
    created_at: string;
  };
  oocytes: Array<{
    id: string;
    oocyte_code: string;
    label: string | null;
    oocyte_number: number;
    maturity: string;
    status: string;
    failure_reason: string | null;
    embryo_id: string | null;
    notes: string | null;
  }>;
  opuSessionId: string;
  donorHorseId: string;
  horseNames: Record<string, string>;
  labName: string | null;
  embryoCodes: Record<string, string>;
  canEdit: boolean;
}) {
  const router = useRouter();
  const stallionName = horseNames[batch.stallion_horse_id] ?? "Unknown";
  const donorName = donorHorseId ? (horseNames[donorHorseId] ?? "Unknown") : "Unknown";

  const isComplete = batch.status === "complete";
  const hasUnresolved = oocytes.some(
    (o) => o.status !== "developed" && o.status !== "failed",
  );
  const canRecordResults = canEdit && !isComplete && hasUnresolved;

  // --- Results form state ---
  const [showResultsForm, setShowResultsForm] = useState(false);
  const [results, setResults] = useState<OocyteResult[]>(
    oocytes
      .filter((o) => o.status !== "developed" && o.status !== "failed")
      .map((o) => ({
        oocyte_id: o.id,
        outcome: "" as "" | "developed" | "failed",
        failure_reason: "",
        grade: "grade_1",
        stage: "blastocyst",
      })),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateResult(idx: number, field: keyof OocyteResult, value: string) {
    setResults((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  }

  async function handleResultsSubmit() {
    const toSubmit = results.filter((r) => r.outcome === "developed" || r.outcome === "failed");
    if (toSubmit.length === 0) {
      setError("Mark at least one oocyte as developed or failed");
      return;
    }

    setSaving(true);
    setError(null);

    const payload = toSubmit.map((r) => ({
      oocyte_id: r.oocyte_id,
      outcome: r.outcome as "developed" | "failed",
      failure_reason: r.outcome === "failed" ? r.failure_reason || "other" : undefined,
      grade: r.outcome === "developed" ? r.grade : undefined,
      stage: r.outcome === "developed" ? r.stage : undefined,
    }));

    const result = await recordICSIResultsAction(batch.id, payload);

    if (result.error) {
      setError(result.error);
      setSaving(false);
      return;
    }

    setShowResultsForm(false);
    setSaving(false);
    router.refresh();
  }

  // Counts
  const developed = oocytes.filter((o) => o.status === "developed").length;
  const failed = oocytes.filter((o) => o.status === "failed").length;
  const pending = oocytes.length - developed - failed;

  const breadcrumb = [
    { label: "Breeders Pro", href: "/breeders-pro" },
    { label: donorName, href: `/breeders-pro/donors/${donorHorseId}` },
    { label: "OPU", href: `/breeders-pro/opu/${opuSessionId}` },
    { label: `ICSI — ${stallionName}` },
  ];

  return (
    <BreedersProChrome breadcrumb={breadcrumb}>
      {/* ============== HEADER ============== */}
      <div className="bp-profile-header">
        <div className="bp-profile-top">
          <div className="bp-profile-identity">
            <div className="bp-profile-meta">
              <div className="bp-role-tag">ICSI Batch</div>
              <h1 className="bp-profile-name">
                {donorName} × {stallionName}
              </h1>
              <div className="bp-profile-attributes">
                {labName && (
                  <div className="bp-attr">
                    <span className="bp-attr-label">Lab</span>
                    <span>{labName}</span>
                  </div>
                )}
                {batch.semen_type && (
                  <div className="bp-attr">
                    <span className="bp-attr-label">Semen</span>
                    <span>{batch.semen_type}</span>
                  </div>
                )}
                {batch.shipped_date && (
                  <div className="bp-attr">
                    <span className="bp-attr-label">Shipped</span>
                    <span>{fmtIso(batch.shipped_date)}</span>
                  </div>
                )}
                {batch.results_date && (
                  <div className="bp-attr">
                    <span className="bp-attr-label">Results</span>
                    <span>{fmtIso(batch.results_date)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="bp-profile-actions" style={{ alignItems: "center" }}>
            <span className={`bp-status ${STATUS_CLASS[batch.status] ?? "bp-status-shipped"}`}>
              <span className="bp-status-dot" />
              {BATCH_STATUS_LABEL[batch.status] ?? batch.status}
            </span>
            {canRecordResults && !showResultsForm && (
              <button
                type="button"
                className="bp-btn bp-primary"
                onClick={() => {
                  setError(null);
                  setShowResultsForm(true);
                }}
              >
                Record Results
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ============== METRICS ============== */}
      <div
        className="bp-metrics"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          padding: "0 32px",
          margin: "16px 0",
          gap: 1,
          background: "var(--bp-border)",
          border: "1px solid var(--bp-border)",
          borderRadius: 4,
        }}
      >
        {[
          { label: "Oocytes", value: oocytes.length },
          { label: "Developed", value: developed },
          { label: "Failed", value: failed },
          { label: "Pending", value: pending },
        ].map((m) => (
          <div
            key={m.label}
            style={{ padding: "16px 14px", background: "var(--bp-bg-elevated)" }}
          >
            <div className="bp-meta" style={{ marginBottom: 4 }}>{m.label}</div>
            <div className="bp-display bp-num" style={{ fontSize: 24, fontWeight: 300 }}>
              {m.value}
            </div>
          </div>
        ))}
      </div>

      {/* ============== RESULTS FORM ============== */}
      {showResultsForm && (
        <div style={{ padding: "16px 32px" }}>
          <div
            style={{
              padding: 20,
              border: "1px solid var(--bp-border-strong)",
              borderRadius: 6,
              background: "var(--bp-bg-elevated)",
              marginBottom: 20,
            }}
          >
            <div className="bp-meta" style={{ marginBottom: 16 }}>
              Record Results — mark each oocyte
            </div>

            {error && (
              <div
                style={{
                  marginBottom: 12,
                  padding: "8px 12px",
                  background: "#fef2f2",
                  border: "1px solid #fca5a5",
                  borderRadius: 4,
                  color: "#991b1b",
                  fontSize: 12,
                }}
              >
                {error}
              </div>
            )}

            <div className="bp-table-wrap">
              <table className="bp-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Maturity</th>
                    <th>Outcome</th>
                    <th>Grade / Reason</th>
                    <th>Stage</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => {
                    const oocyte = oocytes.find((o) => o.id === r.oocyte_id);
                    return (
                      <tr key={r.oocyte_id}>
                        <td className="bp-mono">
                          {oocyte?.oocyte_code ?? "—"}
                        </td>
                        <td style={{ fontSize: 11 }}>
                          {oocyte?.maturity ?? "—"}
                        </td>
                        <td>
                          <select
                            className="bp-input"
                            value={r.outcome}
                            onChange={(e) =>
                              updateResult(i, "outcome", e.target.value)
                            }
                            style={{ width: 130, fontSize: 12 }}
                          >
                            <option value="">—</option>
                            <option value="developed">Developed</option>
                            <option value="failed">Failed</option>
                          </select>
                        </td>
                        <td>
                          {r.outcome === "developed" ? (
                            <select
                              className="bp-input"
                              value={r.grade}
                              onChange={(e) =>
                                updateResult(i, "grade", e.target.value)
                              }
                              style={{ width: 120, fontSize: 12 }}
                            >
                              {GRADE_OPTIONS.map((g) => (
                                <option key={g.value} value={g.value}>
                                  {g.label}
                                </option>
                              ))}
                            </select>
                          ) : r.outcome === "failed" ? (
                            <select
                              className="bp-input"
                              value={r.failure_reason}
                              onChange={(e) =>
                                updateResult(i, "failure_reason", e.target.value)
                              }
                              style={{ width: 160, fontSize: 12 }}
                            >
                              <option value="">Select reason</option>
                              {FAILURE_OPTIONS.map((f) => (
                                <option key={f.value} value={f.value}>
                                  {f.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="bp-location-muted">—</span>
                          )}
                        </td>
                        <td>
                          {r.outcome === "developed" ? (
                            <select
                              className="bp-input"
                              value={r.stage}
                              onChange={(e) =>
                                updateResult(i, "stage", e.target.value)
                              }
                              style={{ width: 150, fontSize: 12 }}
                            >
                              {STAGE_OPTIONS.map((s) => (
                                <option key={s.value} value={s.value}>
                                  {s.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="bp-location-muted">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button
                type="button"
                className="bp-btn"
                onClick={() => {
                  setShowResultsForm(false);
                  setError(null);
                }}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="bp-btn bp-primary"
                onClick={handleResultsSubmit}
                disabled={saving}
              >
                {saving
                  ? "Recording…"
                  : `Submit Results (${results.filter((r) => r.outcome).length} marked)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============== OOCYTE TABLE (read-only when results recorded) ============== */}
      <div style={{ padding: "16px 32px 48px" }}>
        <div className="bp-section-header" style={{ marginBottom: 12 }}>
          <div className="bp-section-title">Oocytes in this Batch</div>
          <div className="bp-section-meta">{oocytes.length} oocyte{oocytes.length === 1 ? "" : "s"}</div>
        </div>

        <div className="bp-table-wrap">
          <table className="bp-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Label</th>
                <th>Maturity</th>
                <th>Status</th>
                <th>Embryo</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {oocytes.map((o) => (
                <tr key={o.id}>
                  <td className="bp-mono">{o.oocyte_code}</td>
                  <td>
                    {o.label ? (
                      <span style={{ fontSize: 12 }}>{o.label}</span>
                    ) : (
                      <span className="bp-location-muted">—</span>
                    )}
                  </td>
                  <td style={{ fontSize: 11 }}>{o.maturity}</td>
                  <td>
                    <span className={`bp-status ${STATUS_CLASS[o.status] ?? ""}`}>
                      <span className="bp-status-dot" />
                      {STATUS_LABEL[o.status] ?? o.status}
                    </span>
                    {o.status === "failed" && o.failure_reason && (
                      <div
                        style={{
                          fontSize: 10,
                          color: "var(--bp-ink-tertiary)",
                          marginTop: 2,
                          fontStyle: "italic",
                        }}
                      >
                        {o.failure_reason.replace(/_/g, " ")}
                      </div>
                    )}
                  </td>
                  <td>
                    {o.embryo_id ? (
                      <Link
                        href={`/breeders-pro/${o.embryo_id}`}
                        className="bp-location-cell"
                        style={{ fontSize: 11 }}
                      >
                        {embryoCodes[o.embryo_id] ?? "View"}
                      </Link>
                    ) : (
                      <span className="bp-location-muted">—</span>
                    )}
                  </td>
                  <td>
                    {o.notes ? (
                      <span style={{ fontSize: 11, color: "var(--bp-ink-secondary)" }}>
                        {o.notes.length > 30 ? o.notes.slice(0, 30) + "…" : o.notes}
                      </span>
                    ) : (
                      <span className="bp-location-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </BreedersProChrome>
  );
}
