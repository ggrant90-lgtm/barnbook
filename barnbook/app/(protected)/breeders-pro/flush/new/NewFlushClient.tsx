"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BreedersProChrome } from "@/components/breeders-pro/BreedersProChrome";
import {
  EMBRYO_GRADES,
  EMBRYO_GRADE_LABELS,
  EMBRYO_STAGES,
  EMBRYO_STAGE_LABELS,
  BREEDING_METHOD_VALUES,
  BREEDING_METHOD_LABELS,
} from "@/lib/horse-form-constants";
import { createFlushEventFirstAction } from "@/app/(protected)/actions/embryo";

/* --------------------------------------------------------------------
 * Breeders Pro — Record Flush (event-first).
 *
 * Presentation only. All writes route through createFlushEventFirstAction
 * which calls the new create_flush_with_horses_and_embryos RPC.
 * ------------------------------------------------------------------ */

type HorseLite = {
  id: string;
  name: string;
  registration_number: string | null;
};

type DonorMode = "existing" | "new";
type SireMode = "existing" | "new";

const breadcrumb = [
  { label: "Breeders Pro", href: "/breeders-pro" },
  { label: "Embryo Bank", href: "/breeders-pro" },
  { label: "New Flush" },
];

export function NewFlushClient({
  donors,
  stallions,
}: {
  donors: HorseLite[];
  stallions: HorseLite[];
}) {
  const router = useRouter();

  // ---------- Donor state ----------
  const [donorMode, setDonorMode] = useState<DonorMode>(
    donors.length > 0 ? "existing" : "new",
  );
  const [donorHorseId, setDonorHorseId] = useState<string>("");
  const [donorName, setDonorName] = useState("");
  const [donorRegistration, setDonorRegistration] = useState("");
  const [donorBreed, setDonorBreed] = useState("");
  const [donorColor, setDonorColor] = useState("");
  const [donorFoalDate, setDonorFoalDate] = useState("");

  // ---------- Sire state ----------
  const [sireMode, setSireMode] = useState<SireMode>(
    stallions.length > 0 ? "existing" : "new",
  );
  const [sireHorseId, setSireHorseId] = useState<string>("");
  const [sireName, setSireName] = useState("");
  const [sireRegistration, setSireRegistration] = useState("");
  const [sireBreed, setSireBreed] = useState("");
  const [sireColor, setSireColor] = useState("");
  const [sireFoalDate, setSireFoalDate] = useState("");

  // ---------- Flush fields ----------
  const today = new Date().toISOString().slice(0, 10);
  const [flushDate, setFlushDate] = useState(today);
  const [vetName, setVetName] = useState("");
  const [breedingMethod, setBreedingMethod] =
    useState<(typeof BREEDING_METHOD_VALUES)[number]>("ai_fresh");
  const [flushCost, setFlushCost] = useState("");
  const [notes, setNotes] = useState("");

  // ---------- Embryos ----------
  const [embryoCount, setEmbryoCount] = useState<number>(1);
  const countClamped = useMemo(
    () => Math.max(0, Math.min(20, embryoCount)),
    [embryoCount],
  );
  const [embryoRows, setEmbryoRows] = useState<
    { grade: string; stage: string; label: string }[]
  >([{ grade: "grade_1", stage: "morula", label: "" }]);

  function setCount(n: number) {
    const clamped = Math.max(0, Math.min(20, n));
    setEmbryoCount(clamped);
    setEmbryoRows((prev) => {
      const next = [...prev];
      while (next.length < clamped) {
        next.push({ grade: "grade_1", stage: "morula", label: "" });
      }
      next.length = clamped;
      return next;
    });
  }

  // ---------- Submission ----------
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const formData = new FormData(e.currentTarget);

    const result = await createFlushEventFirstAction(formData);
    if (result.error) {
      setError(result.error);
      setSaving(false);
      return;
    }

    // Success — land back in the Embryo Bank where the new rows will appear
    router.push("/breeders-pro");
    router.refresh();
  }

  return (
    <BreedersProChrome breadcrumb={breadcrumb}>
      {/* ============== HEADER ============== */}
      <div className="bp-page-header">
        <div className="bp-page-title-row">
          <div>
            <h1 className="bp-page-title">Record Flush</h1>
            <p className="bp-page-subtitle">
              Capture the donor, sire, flush details, and recovered embryos in
              a single record. New horses can be added inline.
            </p>
          </div>
          <div className="bp-page-meta">
            {countClamped} {countClamped === 1 ? "EMBRYO" : "EMBRYOS"} ·
            DRAFT
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="bp-content" style={{ alignItems: "start" }}>
          {/* ============== MAIN COLUMN ============== */}
          <div className="bp-content-main">
            {/* --- Donor Mare --- */}
            <div className="bp-side-section">
              <div className="bp-side-label">Donor Mare</div>

              <ModeToggle
                name="donor_mode"
                value={donorMode}
                onChange={(v) => setDonorMode(v as DonorMode)}
                options={[
                  {
                    value: "existing",
                    label: `Existing (${donors.length})`,
                    disabled: donors.length === 0,
                  },
                  { value: "new", label: "Add new mare" },
                ]}
              />

              {donorMode === "existing" ? (
                <div className="bp-field" style={{ marginTop: 14 }}>
                  <label className="bp-field-label">Select Mare</label>
                  <select
                    name="donor_horse_id"
                    className="bp-select"
                    value={donorHorseId}
                    onChange={(e) => setDonorHorseId(e.target.value)}
                    required={donorMode === "existing"}
                  >
                    <option value="">Select donor mare…</option>
                    {donors.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                        {h.registration_number
                          ? ` · ${h.registration_number}`
                          : ""}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 14,
                    marginTop: 14,
                  }}
                >
                  <div className="bp-field">
                    <label className="bp-field-label">Name *</label>
                    <input
                      type="text"
                      name="donor_name"
                      className="bp-input"
                      value={donorName}
                      onChange={(e) => setDonorName(e.target.value)}
                      placeholder="Mare name"
                      required={donorMode === "new"}
                    />
                  </div>
                  <div className="bp-field-row">
                    <div className="bp-field">
                      <label className="bp-field-label">Registration</label>
                      <input
                        type="text"
                        name="donor_registration_number"
                        className="bp-input"
                        value={donorRegistration}
                        onChange={(e) => setDonorRegistration(e.target.value)}
                      />
                    </div>
                    <div className="bp-field">
                      <label className="bp-field-label">Breed</label>
                      <input
                        type="text"
                        name="donor_breed"
                        className="bp-input"
                        value={donorBreed}
                        onChange={(e) => setDonorBreed(e.target.value)}
                      />
                    </div>
                    <div className="bp-field">
                      <label className="bp-field-label">Color</label>
                      <input
                        type="text"
                        name="donor_color"
                        className="bp-input"
                        value={donorColor}
                        onChange={(e) => setDonorColor(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="bp-field">
                    <label className="bp-field-label">Foal Date</label>
                    <input
                      type="date"
                      name="donor_foal_date"
                      className="bp-input"
                      value={donorFoalDate}
                      onChange={(e) => setDonorFoalDate(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* --- Sire --- */}
            <div className="bp-side-section">
              <div className="bp-side-label">Sire</div>

              <ModeToggle
                name="sire_mode"
                value={sireMode}
                onChange={(v) => setSireMode(v as SireMode)}
                options={[
                  {
                    value: "existing",
                    label: `Existing (${stallions.length})`,
                    disabled: stallions.length === 0,
                  },
                  { value: "new", label: "Add new stallion" },
                ]}
              />

              {sireMode === "existing" && (
                <div className="bp-field" style={{ marginTop: 14 }}>
                  <label className="bp-field-label">Select Stallion</label>
                  <select
                    name="sire_horse_id"
                    className="bp-select"
                    value={sireHorseId}
                    onChange={(e) => setSireHorseId(e.target.value)}
                    required={sireMode === "existing"}
                  >
                    <option value="">Select barn stallion…</option>
                    {stallions.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                        {h.registration_number
                          ? ` · ${h.registration_number}`
                          : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {sireMode === "new" && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 14,
                    marginTop: 14,
                  }}
                >
                  <div className="bp-field">
                    <label className="bp-field-label">Name *</label>
                    <input
                      type="text"
                      name="sire_name"
                      className="bp-input"
                      value={sireName}
                      onChange={(e) => setSireName(e.target.value)}
                      placeholder="Stallion name"
                      required={sireMode === "new"}
                    />
                  </div>
                  <div className="bp-field-row">
                    <div className="bp-field">
                      <label className="bp-field-label">Registration</label>
                      <input
                        type="text"
                        name="sire_registration_number"
                        className="bp-input"
                        value={sireRegistration}
                        onChange={(e) => setSireRegistration(e.target.value)}
                      />
                    </div>
                    <div className="bp-field">
                      <label className="bp-field-label">Breed</label>
                      <input
                        type="text"
                        name="sire_breed"
                        className="bp-input"
                        value={sireBreed}
                        onChange={(e) => setSireBreed(e.target.value)}
                      />
                    </div>
                    <div className="bp-field">
                      <label className="bp-field-label">Color</label>
                      <input
                        type="text"
                        name="sire_color"
                        className="bp-input"
                        value={sireColor}
                        onChange={(e) => setSireColor(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="bp-field">
                    <label className="bp-field-label">Foal Date</label>
                    <input
                      type="date"
                      name="sire_foal_date"
                      className="bp-input"
                      value={sireFoalDate}
                      onChange={(e) => setSireFoalDate(e.target.value)}
                    />
                  </div>
                </div>
              )}

            </div>

            {/* --- Flush Details --- */}
            <div className="bp-side-section">
              <div className="bp-side-label">Flush Details</div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  marginTop: 6,
                }}
              >
                <div className="bp-field-row">
                  <div className="bp-field">
                    <label className="bp-field-label">Flush Date *</label>
                    <input
                      type="date"
                      name="flush_date"
                      className="bp-input"
                      value={flushDate}
                      onChange={(e) => setFlushDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="bp-field">
                    <label className="bp-field-label">Veterinarian</label>
                    <input
                      type="text"
                      name="veterinarian_name"
                      className="bp-input"
                      value={vetName}
                      onChange={(e) => setVetName(e.target.value)}
                      placeholder="Dr. Smith"
                    />
                  </div>
                  <div className="bp-field">
                    <label className="bp-field-label">Cost (USD)</label>
                    <input
                      type="number"
                      name="flush_cost"
                      className="bp-input"
                      value={flushCost}
                      onChange={(e) => setFlushCost(e.target.value)}
                      step="0.01"
                      min={0}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="bp-field">
                  <label className="bp-field-label">Breeding Method</label>
                  <select
                    name="breeding_method"
                    className="bp-select"
                    value={breedingMethod}
                    onChange={(e) =>
                      setBreedingMethod(
                        e.target
                          .value as (typeof BREEDING_METHOD_VALUES)[number],
                      )
                    }
                  >
                    {BREEDING_METHOD_VALUES.map((v) => (
                      <option key={v} value={v}>
                        {BREEDING_METHOD_LABELS[v]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="bp-field">
                  <label className="bp-field-label">Notes</label>
                  <textarea
                    name="notes"
                    rows={2}
                    className="bp-textarea"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
              </div>
            </div>

            {/* --- Embryos --- */}
            <div className="bp-side-section">
              <div className="bp-side-label">Embryos Recovered</div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginTop: 6,
                }}
              >
                <label
                  className="bp-field-label"
                  style={{ margin: 0, flexShrink: 0 }}
                >
                  Count
                </label>
                <input
                  type="number"
                  name="embryo_count"
                  className="bp-input"
                  style={{ width: 88 }}
                  value={embryoCount}
                  onChange={(e) => setCount(parseInt(e.target.value, 10) || 0)}
                  min={1}
                  max={20}
                  required
                />
                <div
                  style={{
                    fontFamily: "var(--bp-font-mono)",
                    fontSize: 10,
                    color: "var(--bp-ink-tertiary)",
                  }}
                >
                  MAX 20 PER FLUSH
                </div>
              </div>

              {countClamped > 0 && (
                <div
                  style={{
                    marginTop: 16,
                    border: "1px solid var(--bp-border)",
                    borderRadius: 4,
                    overflow: "hidden",
                  }}
                >
                  <table className="bp-table" style={{ marginBottom: 0 }}>
                    <thead>
                      <tr>
                        <th style={{ width: 48 }}>#</th>
                        <th>Grade</th>
                        <th>Stage</th>
                        <th>Label (optional)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {embryoRows.map((row, i) => (
                        <tr key={i}>
                          <td
                            className="bp-mono"
                            style={{ color: "var(--bp-ink-tertiary)" }}
                          >
                            {String(i + 1).padStart(2, "0")}
                          </td>
                          <td>
                            <select
                              name={`grade_${i}`}
                              className="bp-select"
                              value={row.grade}
                              onChange={(e) => {
                                const v = e.target.value;
                                setEmbryoRows((prev) => {
                                  const next = [...prev];
                                  next[i] = { ...next[i], grade: v };
                                  return next;
                                });
                              }}
                              style={{ height: 28, padding: "2px 8px" }}
                            >
                              {EMBRYO_GRADES.map((g) => (
                                <option key={g} value={g}>
                                  {EMBRYO_GRADE_LABELS[g]}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <select
                              name={`stage_${i}`}
                              className="bp-select"
                              value={row.stage}
                              onChange={(e) => {
                                const v = e.target.value;
                                setEmbryoRows((prev) => {
                                  const next = [...prev];
                                  next[i] = { ...next[i], stage: v };
                                  return next;
                                });
                              }}
                              style={{ height: 28, padding: "2px 8px" }}
                            >
                              {EMBRYO_STAGES.map((s) => (
                                <option key={s} value={s}>
                                  {EMBRYO_STAGE_LABELS[s]}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              type="text"
                              name={`label_${i}`}
                              className="bp-input"
                              value={row.label}
                              onChange={(e) => {
                                const v = e.target.value;
                                setEmbryoRows((prev) => {
                                  const next = [...prev];
                                  next[i] = { ...next[i], label: v };
                                  return next;
                                });
                              }}
                              style={{ height: 28, padding: "2px 8px" }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* ============== SIDE COLUMN ============== */}
          <aside className="bp-content-side">
            <div className="bp-side-section">
              <div className="bp-side-label">Summary</div>
              <div className="bp-info-list">
                <div className="bp-info-row">
                  <span className="bp-info-key">Donor</span>
                  <span className="bp-info-value">
                    {donorMode === "existing"
                      ? donors.find((d) => d.id === donorHorseId)?.name ?? "—"
                      : donorName || "—"}
                  </span>
                </div>
                <div className="bp-info-row">
                  <span className="bp-info-key">Sire</span>
                  <span className="bp-info-value">
                    {sireMode === "existing"
                      ? stallions.find((s) => s.id === sireHorseId)?.name ??
                        "—"
                      : sireName || "—"}
                  </span>
                </div>
                <div className="bp-info-row">
                  <span className="bp-info-key">Date</span>
                  <span className="bp-info-value bp-mono">
                    {flushDate || "—"}
                  </span>
                </div>
                <div className="bp-info-row">
                  <span className="bp-info-key">Method</span>
                  <span className="bp-info-value">
                    {BREEDING_METHOD_LABELS[breedingMethod]}
                  </span>
                </div>
                <div className="bp-info-row">
                  <span className="bp-info-key">Embryos</span>
                  <span className="bp-info-value bp-mono">{countClamped}</span>
                </div>
                {flushCost && (
                  <div className="bp-info-row">
                    <span className="bp-info-key">Cost</span>
                    <span className="bp-info-value bp-mono">
                      ${parseFloat(flushCost).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div className="bp-modal-error" style={{ margin: 0 }}>
                {error}
              </div>
            )}

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <button
                type="submit"
                className="bp-btn bp-primary"
                disabled={saving}
                style={{ width: "100%" }}
              >
                {saving ? "Recording…" : "Record Flush"}
              </button>
              <button
                type="button"
                className="bp-btn"
                onClick={() => router.push("/breeders-pro")}
                disabled={saving}
                style={{ width: "100%" }}
              >
                Cancel
              </button>
            </div>
          </aside>
        </div>
      </form>
    </BreedersProChrome>
  );
}

/* --------------------------------------------------------------------
 * ModeToggle — segmented control for "Existing / New / External" style
 * mode switches. Renders as a hidden input plus a row of bp-chip buttons
 * so the server action sees a normal form field and the UI matches the
 * filter-chip pattern from the Embryo Bank.
 * ------------------------------------------------------------------ */
function ModeToggle({
  name,
  value,
  onChange,
  options,
}: {
  name: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; disabled?: boolean }[];
}) {
  return (
    <>
      <input type="hidden" name={name} value={value} />
      <div className="bp-filters" style={{ marginTop: 2 }}>
        {options.map((opt) => {
          const isActive = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              className={`bp-chip ${isActive ? "bp-active" : ""}`}
              disabled={opt.disabled}
              onClick={() => !opt.disabled && onChange(opt.value)}
              style={opt.disabled ? { opacity: 0.4, cursor: "not-allowed" } : undefined}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </>
  );
}
