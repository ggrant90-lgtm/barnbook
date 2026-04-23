"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BreedersProChrome } from "@/components/breeders-pro/BreedersProChrome";
import { recordOPUAction } from "@/app/(protected)/actions/opu";

/* --------------------------------------------------------------------
 * Record OPU Session — event-first ICSI entry point.
 *
 * Same inline-picker patterns as the Flush and Live Cover forms:
 * - Donor mare: pick existing or create new
 * - Oocyte count → auto-creates N oocyte rows with OC-YYYY-NNNN codes
 * - Optional maturity breakdown (mature vs immature)
 * - Vet, facility, cost, notes
 * ------------------------------------------------------------------ */

type DonorMode = "existing" | "new";

const breadcrumb = [
  { label: "Breeders Pro", href: "/breeders-pro" },
  { label: "New Breeding", href: "/breeders-pro/breeding/new" },
  { label: "Record OPU" },
];

export function NewOPUClient({
  barnId,
  mares,
}: {
  barnId: string;
  mares: { id: string; name: string; registration_number: string | null }[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [donorMode, setDonorMode] = useState<DonorMode>(
    mares.length > 0 ? "existing" : "new",
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    form.set("barn_id", barnId);
    form.set("donor_mode", donorMode);

    const result = await recordOPUAction(form);

    if (result.error) {
      setError(result.error);
      setSaving(false);
      return;
    }

    // Navigate to OPU session detail to see the oocytes
    router.push(`/breeders-pro/opu/${result.opuSessionId}`);
    router.refresh();
  }

  return (
    <BreedersProChrome breadcrumb={breadcrumb}>
      <div className="bp-page-header">
        <h1 className="bp-display" style={{ fontSize: 28 }}>
          Record OPU Session
        </h1>
        <p
          style={{
            color: "var(--bp-ink-secondary)",
            fontSize: 13,
            marginTop: 4,
          }}
        >
          Aspirate oocytes from a donor mare. Each oocyte gets a unique
          code and can be assigned to ICSI batches afterward.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="px-4 md:px-8 pb-12"
        style={{ maxWidth: 680 }}
      >
        {error && (
          <div
            className="bp-error"
            style={{
              marginBottom: 16,
              padding: "10px 14px",
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

        {/* ===== DONOR MARE ===== */}
        <fieldset style={{ border: "none", padding: 0, margin: "0 0 24px" }}>
          <legend className="bp-meta" style={{ marginBottom: 10 }}>
            Donor Mare
          </legend>

          <div className="bp-mode-toggle" role="radiogroup" style={{ marginBottom: 12, display: "flex", gap: 4 }}>
            <button
              type="button"
              className={`bp-chip ${donorMode === "existing" ? "bp-active" : ""}`}
              onClick={() => setDonorMode("existing")}
            >
              Existing ({mares.length})
            </button>
            <button
              type="button"
              className={`bp-chip ${donorMode === "new" ? "bp-active" : ""}`}
              onClick={() => setDonorMode("new")}
            >
              Add new
            </button>
          </div>

          {donorMode === "existing" ? (
            <select
              name="donor_horse_id"
              required
              className="bp-input"
              defaultValue=""
              style={{ width: "100%" }}
            >
              <option value="" disabled>
                Select a mare
              </option>
              {mares.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.registration_number ? ` (${m.registration_number})` : ""}
                </option>
              ))}
            </select>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <label className="bp-field-label">Name *</label>
                <input
                  name="donor_name"
                  required
                  className="bp-input"
                  placeholder="Mare name"
                  style={{ width: "100%" }}
                />
              </div>
              <div className="bp-field-row">
                <div>
                  <label className="bp-field-label">Registration</label>
                  <input
                    name="donor_registration"
                    className="bp-input"
                    placeholder="Optional"
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <label className="bp-field-label">Breed</label>
                  <input
                    name="donor_breed"
                    className="bp-input"
                    placeholder="Optional"
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <label className="bp-field-label">Color</label>
                  <input
                    name="donor_color"
                    className="bp-input"
                    placeholder="Optional"
                    style={{ width: "100%" }}
                  />
                </div>
              </div>
              <div>
                <label className="bp-field-label">Year Foaled</label>
                <input
                  name="donor_foal_date"
                  type="date"
                  className="bp-input"
                  style={{ width: 180 }}
                />
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 13, color: "var(--bp-ink-secondary)", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  name="donor_add_to_barnbook"
                  value="true"
                  style={{ accentColor: "var(--bp-accent)" }}
                />
                Also add to BarnBook horse list
              </label>
            </div>
          )}
        </fieldset>

        {/* ===== OPU DETAILS ===== */}
        <fieldset style={{ border: "none", padding: 0, margin: "0 0 24px" }}>
          <legend className="bp-meta" style={{ marginBottom: 10 }}>
            Aspiration Details
          </legend>

          <div className="bp-field-row">
            <div>
              <label className="bp-field-label">OPU Date *</label>
              <input
                name="opu_date"
                type="date"
                required
                className="bp-input"
                defaultValue={new Date().toISOString().slice(0, 10)}
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <label className="bp-field-label">Veterinarian</label>
              <input
                name="veterinarian"
                className="bp-input"
                placeholder="Dr. Smith"
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <label className="bp-field-label">Facility</label>
              <input
                name="facility"
                className="bp-input"
                placeholder="Clinic name"
                style={{ width: "100%" }}
              />
            </div>
          </div>
        </fieldset>

        {/* ===== OOCYTE COUNTS ===== */}
        <fieldset style={{ border: "none", padding: 0, margin: "0 0 24px" }}>
          <legend className="bp-meta" style={{ marginBottom: 10 }}>
            Oocytes Recovered
          </legend>

          <div className="bp-field-row">
            <div>
              <label className="bp-field-label">Total Oocytes *</label>
              <input
                name="oocytes_recovered"
                type="number"
                min="1"
                max="100"
                required
                className="bp-input"
                placeholder="12"
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <label className="bp-field-label">Mature (MII)</label>
              <input
                name="oocytes_mature"
                type="number"
                min="0"
                className="bp-input"
                placeholder="Optional"
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <label className="bp-field-label">Immature</label>
              <input
                name="oocytes_immature"
                type="number"
                min="0"
                className="bp-input"
                placeholder="Optional"
                style={{ width: "100%" }}
              />
            </div>
          </div>

          <p
            style={{
              fontSize: 11,
              color: "var(--bp-ink-tertiary)",
              marginTop: 8,
              fontFamily: "var(--bp-font-mono)",
            }}
          >
            Each oocyte will be created with an auto-generated code
            (OC-YYYY-NNNN). You can relabel individual oocytes later.
          </p>
        </fieldset>

        {/* ===== COST + NOTES ===== */}
        <fieldset style={{ border: "none", padding: 0, margin: "0 0 24px" }}>
          <legend className="bp-meta" style={{ marginBottom: 10 }}>
            Cost and Notes
          </legend>

          <div className="bp-field-row">
            <div>
              <label className="bp-field-label">OPU Cost ($)</label>
              <input
                name="cost"
                type="number"
                step="0.01"
                min="0"
                className="bp-input"
                placeholder="0.00"
                style={{ width: "100%" }}
              />
            </div>
            <div style={{ gridColumn: "span 2" }}>
              <label className="bp-field-label">Notes</label>
              <textarea
                name="notes"
                className="bp-input"
                rows={2}
                placeholder="Optional notes about the aspiration"
                style={{ width: "100%", resize: "vertical" }}
              />
            </div>
          </div>
        </fieldset>

        {/* ===== SUBMIT ===== */}
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            type="button"
            className="bp-btn"
            onClick={() => router.back()}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="bp-btn bp-primary"
            disabled={saving}
          >
            {saving ? "Recording…" : "Record OPU Session"}
          </button>
        </div>
      </form>
    </BreedersProChrome>
  );
}
