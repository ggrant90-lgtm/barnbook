"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Embryo } from "@/lib/types";
import type { EmbryoLocation } from "@/lib/embryo-location";
import {
  EMBRYO_STATUS_LABELS,
  EMBRYO_GRADE_LABELS,
  EMBRYO_STAGE_LABELS,
  FREEZE_METHOD_LABELS,
  FREEZE_METHODS,
  LOSS_REASON_LABELS,
  LOSS_REASONS,
  type EmbryoStatus,
} from "@/lib/horse-form-constants";
import {
  transferEmbryoWithSurrogateAction,
  freezeEmbryoAction,
  shipEmbryoAction,
  markEmbryoLostAction,
  deleteEmbryoAction,
} from "@/app/(protected)/actions/embryo";
import { BreedersProChrome } from "@/components/breeders-pro/BreedersProChrome";

/* --------------------------------------------------------------------
 * Embryo Detail — presentation layer (Breeders Pro reskin).
 *
 * Scope: markup, styles, component composition only. The embryo data,
 * horse lookup, surrogate list, and canEdit flag all come directly from
 * the server page above. All mutations route through the same server
 * actions the old implementation used: no data, workflow, or business
 * logic has been touched.
 * ------------------------------------------------------------------ */

const STATUS_CLASS: Record<EmbryoStatus, string> = {
  in_bank_fresh: "bp-status-fresh",
  in_bank_frozen: "bp-status-frozen",
  transferred: "bp-status-transferred",
  became_foal: "bp-status-foal",
  shipped_out: "bp-status-shipped",
  lost: "bp-status-lost",
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

type ModalType = "transfer" | "freeze" | "ship" | "lost" | null;
type SurrogateMode = "existing" | "new";

export function EmbryoDetailClient({
  embryo,
  horseNames,
  canEdit,
  location,
  surrogates,
}: {
  embryo: Embryo;
  horseNames: Record<string, string>;
  canEdit: boolean;
  location: EmbryoLocation;
  surrogates: {
    id: string;
    name: string;
    registration_number: string | null;
  }[];
}) {
  const router = useRouter();
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Transfer modal — surrogate picker mode
  const [surrogateMode, setSurrogateMode] = useState<SurrogateMode>(
    surrogates.length > 0 ? "existing" : "new",
  );

  const donorName = horseNames[embryo.donor_horse_id] ?? "Unknown";
  const stallionName = embryo.stallion_horse_id
    ? (horseNames[embryo.stallion_horse_id] ?? "Unknown")
    : (embryo.external_stallion_name ?? "External");

  const canTransfer =
    embryo.status === "in_bank_fresh" || embryo.status === "in_bank_frozen";
  const canFreeze = embryo.status === "in_bank_fresh";
  const canShip =
    embryo.status === "in_bank_fresh" || embryo.status === "in_bank_frozen";
  const canMarkLost =
    embryo.status === "in_bank_fresh" || embryo.status === "in_bank_frozen";
  const canDelete =
    embryo.status !== "transferred" && embryo.status !== "became_foal";

  const title = embryo.label || embryo.embryo_code;
  const statusClass = STATUS_CLASS[embryo.status];
  const statusLabel = EMBRYO_STATUS_LABELS[embryo.status];

  const breadcrumb = [
    { label: "Breeders Pro", href: "/breeders-pro" },
    { label: "Embryo Bank", href: "/breeders-pro" },
    { label: embryo.embryo_code },
  ];

  async function handleAction(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const formData = new FormData(e.currentTarget);

    let result: { error?: string };
    switch (activeModal) {
      case "transfer":
        result = await transferEmbryoWithSurrogateAction(embryo.id, formData);
        break;
      case "freeze":
        result = await freezeEmbryoAction(embryo.id, formData);
        break;
      case "ship":
        result = await shipEmbryoAction(embryo.id, formData);
        break;
      case "lost":
        result = await markEmbryoLostAction(embryo.id, formData);
        break;
      default:
        result = { error: "Unknown action" };
    }

    if (result.error) {
      setError(result.error);
      setSaving(false);
      return;
    }

    setActiveModal(null);
    setSaving(false);
    router.refresh();
  }

  const modalTitle =
    activeModal === "transfer"
      ? "Transfer to Surrogate"
      : activeModal === "freeze"
        ? "Freeze Embryo"
        : activeModal === "ship"
          ? "Ship Embryo"
          : activeModal === "lost"
            ? "Mark Embryo as Lost"
            : "";

  return (
    <BreedersProChrome breadcrumb={breadcrumb}>
      {/* ============== HEADER ============== */}
      <div className="bp-profile-header">
        <div className="bp-profile-top">
          <div className="bp-profile-identity">
            <div className="bp-profile-meta">
              <div className="bp-role-tag">Embryo</div>
              <h1 className="bp-profile-name">{title}</h1>
              <div className="bp-profile-attributes">
                <div className="bp-attr">
                  <span className="bp-attr-label">Code</span>
                  <span className="bp-code">{embryo.embryo_code}</span>
                </div>
                <div className="bp-attr">
                  <span className="bp-attr-label">Grade</span>
                  <span>{EMBRYO_GRADE_LABELS[embryo.grade]}</span>
                </div>
                <div className="bp-attr">
                  <span className="bp-attr-label">Stage</span>
                  <span>{EMBRYO_STAGE_LABELS[embryo.stage]}</span>
                </div>
                <div className="bp-attr">
                  <span className="bp-attr-label">Created</span>
                  <span>{fmtIso(embryo.created_at)}</span>
                </div>
              </div>
            </div>
          </div>
          <div
            className="bp-profile-actions"
            style={{ alignItems: "center", flexWrap: "wrap" }}
          >
            <div
              className={`bp-status ${statusClass}`}
              style={{ marginRight: 4 }}
            >
              <span className="bp-status-dot" />
              {statusLabel}
            </div>
            {canEdit && canTransfer && (
              <button
                type="button"
                className="bp-btn bp-primary"
                onClick={() => {
                  setError(null);
                  setActiveModal("transfer");
                }}
              >
                Transfer
              </button>
            )}
            {canEdit && canFreeze && (
              <button
                type="button"
                className="bp-btn"
                onClick={() => {
                  setError(null);
                  setActiveModal("freeze");
                }}
              >
                Freeze
              </button>
            )}
            {canEdit && canShip && (
              <button
                type="button"
                className="bp-btn"
                onClick={() => {
                  setError(null);
                  setActiveModal("ship");
                }}
              >
                Ship Out
              </button>
            )}
            {canEdit && canMarkLost && (
              <button
                type="button"
                className="bp-btn"
                onClick={() => {
                  setError(null);
                  setActiveModal("lost");
                }}
              >
                Mark Lost
              </button>
            )}
          </div>
        </div>

        {/* Parentage strip */}
        <div
          style={{
            marginTop: 24,
            padding: "14px 16px",
            background: "var(--bp-bg-sunken)",
            border: "1px solid var(--bp-border)",
            borderRadius: 4,
            display: "flex",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              fontFamily: "var(--bp-font-mono)",
              fontSize: 9,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "var(--bp-ink-tertiary)",
              flexShrink: 0,
            }}
          >
            Parentage
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              fontSize: 12,
              flex: 1,
              flexWrap: "wrap",
            }}
          >
            <Link
              href={`/breeders-pro/donors/${embryo.donor_horse_id}`}
              style={{
                color: "var(--bp-ink)",
                textDecoration: "none",
                fontWeight: 500,
              }}
            >
              {donorName}
            </Link>
            <span
              style={{
                color: "var(--bp-ink-tertiary)",
                fontFamily: "var(--bp-font-mono)",
              }}
            >
              ×
            </span>
            {embryo.stallion_horse_id ? (
              <Link
                href={`/breeders-pro/stallions/${embryo.stallion_horse_id}`}
                style={{
                  color: "var(--bp-ink)",
                  textDecoration: "none",
                  fontWeight: 500,
                }}
              >
                {stallionName}
              </Link>
            ) : (
              <span style={{ color: "var(--bp-ink)", fontWeight: 500 }}>
                {stallionName}
              </span>
            )}
          </div>
        </div>

        {/* ============== CURRENT LOCATION STRIP ============== */}
        {/* Full-width strip so "where is this embryo right now?" is
            the first thing you see. Same visual language as the
            Parentage strip above. */}
        <div
          className={`bp-location-strip bp-location-${location.kind}`}
        >
          <div className="bp-location-label">Current Location</div>
          <div className="bp-location-value">
            {location.href ? (
              <Link href={location.href} className="bp-location-link">
                {location.label}
              </Link>
            ) : (
              <span
                className={location.muted ? "bp-location-muted" : undefined}
              >
                {location.label}
              </span>
            )}
            {location.detail && (
              <div className="bp-location-detail">{location.detail}</div>
            )}
          </div>
        </div>
      </div>

      {/* ============== CONTENT ============== */}
      <div className="bp-content">
        <div className="bp-content-main">
          {/* Provenance */}
          <div className="bp-side-section">
            <div className="bp-side-label">Provenance</div>
            <div className="bp-info-list">
              <div className="bp-info-row">
                <span className="bp-info-key">Donor Mare</span>
                <span className="bp-info-value">{donorName}</span>
              </div>
              <div className="bp-info-row">
                <span className="bp-info-key">Sire</span>
                <span className="bp-info-value">{stallionName}</span>
              </div>
              <div className="bp-info-row">
                <span className="bp-info-key">Grade</span>
                <span className="bp-info-value">
                  {EMBRYO_GRADE_LABELS[embryo.grade]}
                </span>
              </div>
              <div className="bp-info-row">
                <span className="bp-info-key">Stage</span>
                <span className="bp-info-value">
                  {EMBRYO_STAGE_LABELS[embryo.stage]}
                </span>
              </div>
              <div className="bp-info-row">
                <span className="bp-info-key">Created</span>
                <span className="bp-info-value bp-mono">
                  {fmtIso(embryo.created_at)}
                </span>
              </div>
            </div>
          </div>

          {/* Storage (if frozen) */}
          {embryo.status === "in_bank_frozen" && (
            <div className="bp-side-section">
              <div className="bp-side-label">Storage</div>
              <div className="bp-info-list">
                <div className="bp-info-row">
                  <span className="bp-info-key">Facility</span>
                  <span className="bp-info-value">
                    {embryo.storage_facility || "—"}
                  </span>
                </div>
                <div className="bp-info-row">
                  <span className="bp-info-key">Tank</span>
                  <span className="bp-info-value bp-mono">
                    {embryo.storage_tank || "—"}
                  </span>
                </div>
                <div className="bp-info-row">
                  <span className="bp-info-key">Cane</span>
                  <span className="bp-info-value bp-mono">
                    {embryo.storage_cane || "—"}
                  </span>
                </div>
                <div className="bp-info-row">
                  <span className="bp-info-key">Position</span>
                  <span className="bp-info-value bp-mono">
                    {embryo.storage_position || "—"}
                  </span>
                </div>
                <div className="bp-info-row">
                  <span className="bp-info-key">Freeze Date</span>
                  <span className="bp-info-value bp-mono">
                    {fmtIso(embryo.freeze_date)}
                  </span>
                </div>
                <div className="bp-info-row">
                  <span className="bp-info-key">Method</span>
                  <span className="bp-info-value">
                    {embryo.freeze_method
                      ? FREEZE_METHOD_LABELS[embryo.freeze_method]
                      : "—"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Shipment (if shipped) */}
          {embryo.status === "shipped_out" && (
            <div className="bp-side-section">
              <div className="bp-side-label">Shipment</div>
              <div className="bp-info-list">
                <div className="bp-info-row">
                  <span className="bp-info-key">Shipped To</span>
                  <span className="bp-info-value">
                    {embryo.shipped_to || "—"}
                  </span>
                </div>
                <div className="bp-info-row">
                  <span className="bp-info-key">Ship Date</span>
                  <span className="bp-info-value bp-mono">
                    {fmtIso(embryo.ship_date)}
                  </span>
                </div>
                <div className="bp-info-row">
                  <span className="bp-info-key">Sale Price</span>
                  <span className="bp-info-value bp-mono">
                    {embryo.sale_price != null
                      ? `$${embryo.sale_price.toLocaleString()}`
                      : "—"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Loss (if lost) */}
          {embryo.status === "lost" && (
            <div className="bp-side-section">
              <div className="bp-side-label">Loss Record</div>
              <div className="bp-info-list">
                <div className="bp-info-row">
                  <span className="bp-info-key">Reason</span>
                  <span className="bp-info-value">
                    {embryo.loss_reason
                      ? LOSS_REASON_LABELS[embryo.loss_reason]
                      : "—"}
                  </span>
                </div>
                <div className="bp-info-row">
                  <span className="bp-info-key">Date</span>
                  <span className="bp-info-value bp-mono">
                    {fmtIso(embryo.loss_date)}
                  </span>
                </div>
              </div>
              {embryo.loss_notes && (
                <div
                  style={{
                    marginTop: 12,
                    padding: 12,
                    background: "var(--bp-bg-sunken)",
                    border: "1px solid var(--bp-border)",
                    borderRadius: 4,
                    fontSize: 12,
                    color: "var(--bp-ink-secondary)",
                    lineHeight: 1.55,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {embryo.loss_notes}
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          {embryo.notes && (
            <div className="bp-side-section">
              <div className="bp-side-label">Notes</div>
              <div
                style={{
                  padding: 14,
                  background: "var(--bp-bg-sunken)",
                  border: "1px solid var(--bp-border)",
                  borderRadius: 4,
                  fontSize: 12,
                  color: "var(--bp-ink-secondary)",
                  lineHeight: 1.55,
                  whiteSpace: "pre-wrap",
                }}
              >
                {embryo.notes}
              </div>
            </div>
          )}
        </div>

        <aside className="bp-content-side">
          <div className="bp-side-section">
            <div className="bp-side-label">Identifiers</div>
            <div className="bp-info-list">
              <div className="bp-info-row">
                <span className="bp-info-key">Code</span>
                <span className="bp-info-value bp-mono">
                  {embryo.embryo_code}
                </span>
              </div>
              {embryo.label && (
                <div className="bp-info-row">
                  <span className="bp-info-key">Label</span>
                  <span className="bp-info-value">{embryo.label}</span>
                </div>
              )}
              <div className="bp-info-row">
                <span className="bp-info-key">Status</span>
                <span className="bp-info-value">{statusLabel}</span>
              </div>
            </div>
          </div>

          {canEdit && canDelete && (
            <div className="bp-side-section">
              <div className="bp-side-label">Record</div>
              {confirmingDelete ? (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 10 }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--bp-ink-secondary)",
                      lineHeight: 1.55,
                    }}
                  >
                    Permanently remove this embryo record. This action cannot
                    be undone.
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      className="bp-btn bp-primary"
                      disabled={saving}
                      onClick={async () => {
                        setSaving(true);
                        setError(null);
                        const result = await deleteEmbryoAction(embryo.id);
                        if (result.error) {
                          setError(result.error);
                          setSaving(false);
                          setConfirmingDelete(false);
                        } else {
                          router.push("/breeders-pro");
                          router.refresh();
                        }
                      }}
                    >
                      {saving ? "Deleting…" : "Confirm Delete"}
                    </button>
                    <button
                      type="button"
                      className="bp-btn"
                      onClick={() => setConfirmingDelete(false)}
                      disabled={saving}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="bp-btn"
                  style={{ width: "100%" }}
                  onClick={() => setConfirmingDelete(true)}
                >
                  Delete Record
                </button>
              )}
              {error && !activeModal && (
                <div
                  style={{
                    marginTop: 10,
                    padding: 8,
                    background: "rgba(139,44,44,0.06)",
                    border: "1px solid var(--bp-status-lost)",
                    borderRadius: 3,
                    fontSize: 11,
                    color: "var(--bp-status-lost)",
                    fontFamily: "var(--bp-font-mono)",
                    lineHeight: 1.5,
                  }}
                >
                  {error}
                </div>
              )}
            </div>
          )}
        </aside>
      </div>

      {/* ============== ACTION MODAL ============== */}
      {activeModal && (
        <div
          className="bp-modal-overlay"
          onClick={() => !saving && setActiveModal(null)}
        >
          <div
            className="bp-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bp-modal-header">
              <div className="bp-modal-title">{modalTitle}</div>
              <button
                type="button"
                className="bp-modal-close"
                aria-label="Close"
                onClick={() => !saving && setActiveModal(null)}
              >
                ×
              </button>
            </div>

            {error && <div className="bp-modal-error">{error}</div>}

            <form onSubmit={handleAction}>
              <div className="bp-modal-body">
                {activeModal === "transfer" && (
                  <>
                    {/* Surrogate mode toggle */}
                    <input
                      type="hidden"
                      name="surrogate_mode"
                      value={surrogateMode}
                    />
                    <div className="bp-filters" style={{ marginBottom: 4 }}>
                      <button
                        type="button"
                        className={`bp-chip ${surrogateMode === "existing" ? "bp-active" : ""}`}
                        onClick={() =>
                          surrogates.length > 0 && setSurrogateMode("existing")
                        }
                        disabled={surrogates.length === 0}
                        style={
                          surrogates.length === 0
                            ? { opacity: 0.4, cursor: "not-allowed" }
                            : undefined
                        }
                      >
                        Available ({surrogates.length})
                      </button>
                      <button
                        type="button"
                        className={`bp-chip ${surrogateMode === "new" ? "bp-active" : ""}`}
                        onClick={() => setSurrogateMode("new")}
                      >
                        Add new surrogate
                      </button>
                    </div>

                    {surrogateMode === "existing" ? (
                      <div className="bp-field">
                        <label className="bp-field-label">
                          Surrogate Mare
                        </label>
                        <select
                          name="surrogate_horse_id"
                          className="bp-select"
                          required={surrogateMode === "existing"}
                          defaultValue=""
                        >
                          <option value="">Select surrogate…</option>
                          {surrogates.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                              {s.registration_number
                                ? ` · ${s.registration_number}`
                                : ""}
                            </option>
                          ))}
                        </select>
                        <div
                          style={{
                            marginTop: 4,
                            fontSize: 9,
                            fontFamily: "var(--bp-font-mono)",
                            color: "var(--bp-ink-tertiary)",
                            letterSpacing: "0.05em",
                          }}
                        >
                          MARES WITH AN ACTIVE PREGNANCY ARE HIDDEN
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="bp-field">
                          <label className="bp-field-label">Name *</label>
                          <input
                            type="text"
                            name="surrogate_name"
                            className="bp-input"
                            placeholder="Surrogate mare name"
                            required={surrogateMode === "new"}
                          />
                        </div>
                        <div className="bp-field-row">
                          <div className="bp-field">
                            <label className="bp-field-label">
                              Registration
                            </label>
                            <input
                              type="text"
                              name="surrogate_registration_number"
                              className="bp-input"
                            />
                          </div>
                          <div className="bp-field">
                            <label className="bp-field-label">Breed</label>
                            <input
                              type="text"
                              name="surrogate_breed"
                              className="bp-input"
                            />
                          </div>
                          <div className="bp-field">
                            <label className="bp-field-label">Color</label>
                            <input
                              type="text"
                              name="surrogate_color"
                              className="bp-input"
                            />
                          </div>
                        </div>
                        <div className="bp-field">
                          <label className="bp-field-label">Foal Date</label>
                          <input
                            type="date"
                            name="surrogate_foal_date"
                            className="bp-input"
                          />
                        </div>
                      </>
                    )}

                    <div className="bp-field">
                      <label className="bp-field-label">Transfer Date</label>
                      <input
                        type="date"
                        name="transfer_date"
                        className="bp-input"
                        defaultValue={new Date().toISOString().slice(0, 10)}
                        required
                      />
                    </div>
                    <div className="bp-field">
                      <label className="bp-field-label">Veterinarian</label>
                      <input
                        type="text"
                        name="transfer_veterinarian_name"
                        className="bp-input"
                        placeholder="Dr. Smith"
                      />
                    </div>
                    <div className="bp-field">
                      <label className="bp-field-label">Notes</label>
                      <textarea
                        name="notes"
                        rows={2}
                        className="bp-textarea"
                        placeholder="Optional"
                      />
                    </div>
                  </>
                )}

                {activeModal === "freeze" && (
                  <>
                    <div className="bp-field">
                      <label className="bp-field-label">Storage Facility</label>
                      <input
                        type="text"
                        name="storage_facility"
                        className="bp-input"
                        placeholder="Facility name"
                      />
                    </div>
                    <div className="bp-field-row">
                      <div className="bp-field">
                        <label className="bp-field-label">Tank</label>
                        <input
                          type="text"
                          name="storage_tank"
                          className="bp-input"
                        />
                      </div>
                      <div className="bp-field">
                        <label className="bp-field-label">Cane</label>
                        <input
                          type="text"
                          name="storage_cane"
                          className="bp-input"
                        />
                      </div>
                      <div className="bp-field">
                        <label className="bp-field-label">Position</label>
                        <input
                          type="text"
                          name="storage_position"
                          className="bp-input"
                        />
                      </div>
                    </div>
                    <div className="bp-field">
                      <label className="bp-field-label">Freeze Date</label>
                      <input
                        type="date"
                        name="freeze_date"
                        className="bp-input"
                        defaultValue={new Date().toISOString().slice(0, 10)}
                        required
                      />
                    </div>
                    <div className="bp-field">
                      <label className="bp-field-label">Freeze Method</label>
                      <select
                        name="freeze_method"
                        className="bp-select"
                        defaultValue="vitrification"
                      >
                        {FREEZE_METHODS.map((m) => (
                          <option key={m} value={m}>
                            {FREEZE_METHOD_LABELS[m]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {activeModal === "ship" && (
                  <>
                    <div className="bp-field">
                      <label className="bp-field-label">Shipped To</label>
                      <input
                        type="text"
                        name="shipped_to"
                        className="bp-input"
                        placeholder="Buyer or ranch"
                        required
                      />
                    </div>
                    <div className="bp-field">
                      <label className="bp-field-label">Ship Date</label>
                      <input
                        type="date"
                        name="ship_date"
                        className="bp-input"
                        defaultValue={new Date().toISOString().slice(0, 10)}
                        required
                      />
                    </div>
                    <div className="bp-field">
                      <label className="bp-field-label">Sale Price (USD)</label>
                      <input
                        type="number"
                        name="sale_price"
                        className="bp-input"
                        step="0.01"
                        min={0}
                        placeholder="0.00"
                      />
                    </div>
                  </>
                )}

                {activeModal === "lost" && (
                  <>
                    <div className="bp-field">
                      <label className="bp-field-label">Reason</label>
                      <select
                        name="loss_reason"
                        className="bp-select"
                        defaultValue="other"
                      >
                        {LOSS_REASONS.map((r) => (
                          <option key={r} value={r}>
                            {LOSS_REASON_LABELS[r]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="bp-field">
                      <label className="bp-field-label">Date</label>
                      <input
                        type="date"
                        name="loss_date"
                        className="bp-input"
                        defaultValue={new Date().toISOString().slice(0, 10)}
                        required
                      />
                    </div>
                    <div className="bp-field">
                      <label className="bp-field-label">Notes</label>
                      <textarea
                        name="loss_notes"
                        rows={2}
                        className="bp-textarea"
                        placeholder="Optional"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="bp-modal-actions">
                <button
                  type="button"
                  className="bp-btn"
                  onClick={() => setActiveModal(null)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bp-btn bp-primary"
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Confirm"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </BreedersProChrome>
  );
}
