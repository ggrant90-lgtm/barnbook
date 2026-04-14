"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BreedersProChrome } from "@/components/breeders-pro/BreedersProChrome";
import {
  createICSIBatchAction,
  updateOocyteAction,
} from "@/app/(protected)/actions/opu";

/* --------------------------------------------------------------------
 * OPU Session Detail — command center for an aspiration event.
 *
 * Shows: session metadata, donor mare, oocyte table with multi-select,
 * ICSI batch cards, and an inline "Create ICSI Batch" form.
 *
 * Key interaction: select oocytes via checkbox → click "Create ICSI
 * Batch" → inline form expands with stallion + lab pickers → submit
 * assigns those oocytes to the batch and updates their status.
 * ------------------------------------------------------------------ */

type OocyteStatus = "recovered" | "shipped" | "at_lab" | "injected" | "developed" | "failed";

const STATUS_LABEL: Record<OocyteStatus, string> = {
  recovered: "Recovered",
  shipped: "Shipped",
  at_lab: "At Lab",
  injected: "Injected",
  developed: "Developed",
  failed: "Failed",
};

const STATUS_CLASS: Record<OocyteStatus, string> = {
  recovered: "bp-status-fresh",
  shipped: "bp-status-transferred",
  at_lab: "bp-status-frozen",
  injected: "bp-status-frozen",
  developed: "bp-status-foal",
  failed: "bp-status-lost",
};

const MATURITY_LABEL: Record<string, string> = {
  mature: "Mature (MII)",
  immature: "Immature",
  degenerate: "Degenerate",
  unknown: "Unknown",
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

type SireMode = "existing" | "new";
type LabMode = "existing" | "new";

export function OPUDetailClient({
  session,
  oocytes,
  batches,
  horseNames,
  labNames,
  canEdit,
  stallions,
  labs,
}: {
  session: {
    id: string;
    barn_id: string;
    donor_horse_id: string;
    opu_date: string;
    veterinarian: string | null;
    facility: string | null;
    oocytes_recovered: number;
    oocytes_mature: number | null;
    oocytes_immature: number | null;
    cost: number | null;
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
    icsi_batch_id: string | null;
    embryo_id: string | null;
    notes: string | null;
  }>;
  batches: Array<{
    id: string;
    stallion_horse_id: string;
    lab_id: string | null;
    semen_type: string | null;
    shipped_date: string | null;
    status: string;
    cost: number | null;
    shipping_cost: number | null;
    notes: string | null;
  }>;
  horseNames: Record<string, string>;
  labNames: Record<string, string>;
  canEdit: boolean;
  stallions: { id: string; name: string; registration_number: string | null }[];
  labs: { id: string; name: string; city: string | null; state_province: string | null }[];
}) {
  const router = useRouter();
  const donorName = horseNames[session.donor_horse_id] ?? "Unknown";

  // --- Oocyte selection for batch creation ---
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showBatchForm, setShowBatchForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sireMode, setSireMode] = useState<SireMode>(
    stallions.length > 0 ? "existing" : "new",
  );
  const [labMode, setLabMode] = useState<LabMode>(
    labs.length > 0 ? "existing" : "new",
  );

  // Only unassigned oocytes (no batch yet, not failed) can be selected
  const selectableIds = useMemo(
    () =>
      new Set(
        oocytes
          .filter((o) => !o.icsi_batch_id && o.status !== "failed")
          .map((o) => o.id),
      ),
    [oocytes],
  );

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === selectableIds.size) {
      setSelected(new Set());
    } else {
      setSelected(new Set(selectableIds));
    }
  }

  // --- Batch creation submit ---
  async function handleBatchSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    form.set("barn_id", session.barn_id);
    form.set("opu_session_id", session.id);
    form.set("oocyte_ids", [...selected].join(","));
    form.set("stallion_mode", sireMode);
    form.set("lab_mode", labMode);

    const result = await createICSIBatchAction(form);

    if (result.error) {
      setError(result.error);
      setSaving(false);
      return;
    }

    setSelected(new Set());
    setShowBatchForm(false);
    setSaving(false);
    router.refresh();
  }

  // --- Oocyte counts by status ---
  const counts = useMemo(() => {
    const c = { unassigned: 0, shipped: 0, atLab: 0, developed: 0, failed: 0 };
    for (const o of oocytes) {
      if (!o.icsi_batch_id && o.status !== "failed") c.unassigned++;
      else if (o.status === "shipped" || o.status === "at_lab" || o.status === "injected") c.shipped++;
      else if (o.status === "developed") c.developed++;
      else if (o.status === "failed") c.failed++;
    }
    return c;
  }, [oocytes]);

  const breadcrumb = [
    { label: "Breeders Pro", href: "/breeders-pro" },
    { label: donorName, href: `/breeders-pro/donors/${session.donor_horse_id}` },
    { label: `OPU ${fmtIso(session.opu_date)}` },
  ];

  return (
    <BreedersProChrome breadcrumb={breadcrumb}>
      {/* ============== HEADER ============== */}
      <div className="bp-profile-header">
        <div className="bp-profile-top">
          <div className="bp-profile-identity">
            <div className="bp-profile-meta">
              <div className="bp-role-tag">OPU Session</div>
              <h1 className="bp-profile-name">
                {donorName} — OPU {fmtIso(session.opu_date)}
              </h1>
              <div className="bp-profile-attributes">
                <div className="bp-attr">
                  <span className="bp-attr-label">Date</span>
                  <span>{fmtIso(session.opu_date)}</span>
                </div>
                {session.veterinarian && (
                  <div className="bp-attr">
                    <span className="bp-attr-label">Vet</span>
                    <span>{session.veterinarian}</span>
                  </div>
                )}
                {session.facility && (
                  <div className="bp-attr">
                    <span className="bp-attr-label">Facility</span>
                    <span>{session.facility}</span>
                  </div>
                )}
                {session.cost != null && session.cost > 0 && (
                  <div className="bp-attr">
                    <span className="bp-attr-label">Cost</span>
                    <span className="bp-mono">${session.cost.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        {session.notes && (
          <p style={{ fontSize: 12, color: "var(--bp-ink-secondary)", marginTop: 8 }}>
            {session.notes}
          </p>
        )}
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
          { label: "Total Recovered", value: session.oocytes_recovered },
          { label: "Unassigned", value: counts.unassigned },
          { label: "In Process", value: counts.shipped },
          { label: "Developed", value: counts.developed },
          { label: "Failed", value: counts.failed },
          { label: "Batches", value: batches.length },
        ].map((m) => (
          <div
            key={m.label}
            style={{
              padding: "16px 14px",
              background: "var(--bp-bg-elevated)",
            }}
          >
            <div className="bp-meta" style={{ marginBottom: 4 }}>
              {m.label}
            </div>
            <div
              className="bp-display bp-num"
              style={{ fontSize: 24, fontWeight: 300 }}
            >
              {m.value}
            </div>
          </div>
        ))}
      </div>

      {/* ============== OOCYTES TABLE ============== */}
      <div style={{ padding: "16px 32px" }}>
        <div className="bp-section-header" style={{ marginBottom: 12 }}>
          <div className="bp-section-title">Oocytes</div>
          <div className="bp-section-meta">
            {oocytes.length} total
            {selected.size > 0 && ` · ${selected.size} selected`}
          </div>
        </div>

        {canEdit && selected.size > 0 && !showBatchForm && (
          <div style={{ marginBottom: 12 }}>
            <button
              type="button"
              className="bp-btn bp-primary"
              onClick={() => {
                setError(null);
                setShowBatchForm(true);
              }}
            >
              Create ICSI Batch ({selected.size} oocytes)
            </button>
          </div>
        )}

        {/* ---------- INLINE ICSI BATCH FORM ---------- */}
        {showBatchForm && (
          <form
            onSubmit={handleBatchSubmit}
            style={{
              marginBottom: 20,
              padding: 20,
              border: "1px solid var(--bp-border-strong)",
              borderRadius: 6,
              background: "var(--bp-bg-elevated)",
            }}
          >
            <div className="bp-meta" style={{ marginBottom: 12 }}>
              Create ICSI Batch — {selected.size} oocyte{selected.size === 1 ? "" : "s"} selected
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

            {/* Stallion picker */}
            <fieldset style={{ border: "none", padding: 0, margin: "0 0 16px" }}>
              <legend className="bp-field-label" style={{ marginBottom: 6 }}>Stallion *</legend>
              <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
                <button type="button" className={`bp-chip ${sireMode === "existing" ? "bp-active" : ""}`} onClick={() => setSireMode("existing")}>
                  Existing ({stallions.length})
                </button>
                <button type="button" className={`bp-chip ${sireMode === "new" ? "bp-active" : ""}`} onClick={() => setSireMode("new")}>
                  Add new
                </button>
              </div>
              {sireMode === "existing" ? (
                <select name="stallion_horse_id" required className="bp-input" defaultValue="" style={{ width: "100%" }}>
                  <option value="" disabled>Select a stallion</option>
                  {stallions.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}{s.registration_number ? ` (${s.registration_number})` : ""}</option>
                  ))}
                </select>
              ) : (
                <div style={{ display: "flex", gap: 8 }}>
                  <input name="stallion_name" required className="bp-input" placeholder="Stallion name *" style={{ flex: 1 }} />
                  <input name="stallion_registration" className="bp-input" placeholder="Registration" style={{ width: 140 }} />
                  <input name="stallion_breed" className="bp-input" placeholder="Breed" style={{ width: 120 }} />
                </div>
              )}
            </fieldset>

            {/* Lab picker */}
            <fieldset style={{ border: "none", padding: 0, margin: "0 0 16px" }}>
              <legend className="bp-field-label" style={{ marginBottom: 6 }}>ICSI Lab</legend>
              <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
                <button type="button" className={`bp-chip ${labMode === "existing" ? "bp-active" : ""}`} onClick={() => setLabMode("existing")}>
                  Existing ({labs.length})
                </button>
                <button type="button" className={`bp-chip ${labMode === "new" ? "bp-active" : ""}`} onClick={() => setLabMode("new")}>
                  Add new
                </button>
              </div>
              {labMode === "existing" ? (
                <select name="lab_id" className="bp-input" defaultValue="" style={{ width: "100%" }}>
                  <option value="">No lab selected</option>
                  {labs.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}{l.city ? ` — ${l.city}` : ""}{l.state_province ? `, ${l.state_province}` : ""}</option>
                  ))}
                </select>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <input name="lab_name" required={labMode === "new"} className="bp-input" placeholder="Lab name *" style={{ width: "100%" }} />
                  <div style={{ display: "flex", gap: 8 }}>
                    <input name="lab_city" className="bp-input" placeholder="City" style={{ flex: 1 }} />
                    <input name="lab_state" className="bp-input" placeholder="State" style={{ width: 100 }} />
                    <input name="lab_contact_phone" className="bp-input" placeholder="Phone" style={{ width: 140 }} />
                  </div>
                </div>
              )}
            </fieldset>

            {/* Batch details */}
            <div className="bp-field-row" style={{ marginBottom: 16 }}>
              <div>
                <label className="bp-field-label">Semen Type</label>
                <select name="semen_type" className="bp-input" defaultValue="" style={{ width: "100%" }}>
                  <option value="">—</option>
                  <option value="fresh">Fresh</option>
                  <option value="cooled">Cooled</option>
                  <option value="frozen">Frozen</option>
                </select>
              </div>
              <div>
                <label className="bp-field-label">Ship Date</label>
                <input name="shipped_date" type="date" className="bp-input" style={{ width: "100%" }} />
              </div>
              <div>
                <label className="bp-field-label">Tracking #</label>
                <input name="ship_tracking_to_lab" className="bp-input" placeholder="Optional" style={{ width: "100%" }} />
              </div>
            </div>

            <div className="bp-field-row" style={{ marginBottom: 16 }}>
              <div>
                <label className="bp-field-label">ICSI Cost ($)</label>
                <input name="cost" type="number" step="0.01" min="0" className="bp-input" placeholder="0.00" style={{ width: "100%" }} />
              </div>
              <div>
                <label className="bp-field-label">Shipping Cost ($)</label>
                <input name="shipping_cost" type="number" step="0.01" min="0" className="bp-input" placeholder="0.00" style={{ width: "100%" }} />
              </div>
              <div>
                <label className="bp-field-label">Notes</label>
                <input name="notes" className="bp-input" placeholder="Optional" style={{ width: "100%" }} />
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="bp-btn" onClick={() => { setShowBatchForm(false); setError(null); }} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="bp-btn bp-primary" disabled={saving}>
                {saving ? "Creating…" : `Create Batch (${selected.size} oocytes)`}
              </button>
            </div>
          </form>
        )}

        {/* ---------- OOCYTE TABLE ---------- */}
        <div className="bp-table-wrap">
          <table className="bp-table">
            <thead>
              <tr>
                {canEdit && (
                  <th style={{ width: 36 }}>
                    <input
                      type="checkbox"
                      checked={selected.size === selectableIds.size && selectableIds.size > 0}
                      onChange={toggleAll}
                      aria-label="Select all unassigned oocytes"
                    />
                  </th>
                )}
                <th>Code</th>
                <th>Label</th>
                <th>Maturity</th>
                <th>Status</th>
                <th>Batch</th>
                <th>Embryo</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {oocytes.map((o) => {
                const isSelectable = selectableIds.has(o.id);
                const isSelected = selected.has(o.id);
                const batchForOocyte = o.icsi_batch_id
                  ? batches.find((b) => b.id === o.icsi_batch_id)
                  : null;
                const stallionName = batchForOocyte
                  ? horseNames[batchForOocyte.stallion_horse_id] ?? "Unknown"
                  : null;

                return (
                  <tr
                    key={o.id}
                    style={{
                      background: isSelected
                        ? "var(--bp-accent-soft)"
                        : undefined,
                    }}
                  >
                    {canEdit && (
                      <td>
                        {isSelectable ? (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(o.id)}
                            aria-label={`Select ${o.oocyte_code}`}
                          />
                        ) : (
                          <span style={{ color: "var(--bp-ink-quaternary)" }}>—</span>
                        )}
                      </td>
                    )}
                    <td className="bp-mono">{o.oocyte_code}</td>
                    <td>
                      {o.label ? (
                        <span style={{ fontSize: 12 }}>{o.label}</span>
                      ) : (
                        <span className="bp-location-muted">—</span>
                      )}
                    </td>
                    <td>
                      <span style={{ fontSize: 11 }}>
                        {MATURITY_LABEL[o.maturity] ?? o.maturity}
                      </span>
                    </td>
                    <td>
                      <span className={`bp-status ${STATUS_CLASS[o.status as OocyteStatus] ?? ""}`}>
                        <span className="bp-status-dot" />
                        {STATUS_LABEL[o.status as OocyteStatus] ?? o.status}
                      </span>
                    </td>
                    <td>
                      {batchForOocyte ? (
                        <Link
                          href={`/breeders-pro/icsi/${batchForOocyte.id}`}
                          className="bp-location-cell"
                          style={{ fontSize: 11 }}
                        >
                          {stallionName}
                        </Link>
                      ) : (
                        <span className="bp-location-muted">—</span>
                      )}
                    </td>
                    <td>
                      {o.embryo_id ? (
                        <Link
                          href={`/breeders-pro/${o.embryo_id}`}
                          className="bp-location-cell"
                          style={{ fontSize: 11 }}
                        >
                          View
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
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ============== ICSI BATCHES ============== */}
      {batches.length > 0 && (
        <div style={{ padding: "16px 32px 48px" }}>
          <div className="bp-section-header" style={{ marginBottom: 12 }}>
            <div className="bp-section-title">ICSI Batches</div>
            <div className="bp-section-meta">{batches.length} batch{batches.length === 1 ? "" : "es"}</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {batches.map((b) => {
              const sName = horseNames[b.stallion_horse_id] ?? "Unknown";
              const lName = b.lab_id ? labNames[b.lab_id] ?? "Unknown lab" : "No lab";
              const batchOocytes = oocytes.filter(
                (o) => o.icsi_batch_id === b.id,
              );
              const developed = batchOocytes.filter(
                (o) => o.status === "developed",
              ).length;
              const failed = batchOocytes.filter(
                (o) => o.status === "failed",
              ).length;

              return (
                <Link
                  key={b.id}
                  href={`/breeders-pro/icsi/${b.id}`}
                  style={{
                    textDecoration: "none",
                    color: "inherit",
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    padding: "12px 16px",
                    border: "1px solid var(--bp-border)",
                    borderRadius: 4,
                    background: "var(--bp-bg-elevated)",
                    transition: "border-color 120ms",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--bp-accent)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--bp-border)";
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>
                      {sName}
                    </div>
                    <div
                      className="bp-mono"
                      style={{
                        fontSize: 10,
                        color: "var(--bp-ink-tertiary)",
                        textTransform: "uppercase",
                        marginTop: 2,
                      }}
                    >
                      {lName} · {batchOocytes.length} oocyte{batchOocytes.length === 1 ? "" : "s"}
                      {b.semen_type ? ` · ${b.semen_type} semen` : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    {developed > 0 && (
                      <span className="bp-mono" style={{ fontSize: 11, color: "var(--bp-status-foal)" }}>
                        {developed} embryo{developed === 1 ? "" : "s"}
                      </span>
                    )}
                    {failed > 0 && (
                      <span className="bp-mono" style={{ fontSize: 11, color: "var(--bp-status-lost)" }}>
                        {failed} failed
                      </span>
                    )}
                    <span className={`bp-status ${STATUS_CLASS[b.status as OocyteStatus] ?? "bp-status-shipped"}`}>
                      <span className="bp-status-dot" />
                      {BATCH_STATUS_LABEL[b.status] ?? b.status}
                    </span>
                  </div>
                  <span
                    className="bp-mono"
                    style={{ fontSize: 11, color: "var(--bp-accent)" }}
                  >
                    →
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </BreedersProChrome>
  );
}
