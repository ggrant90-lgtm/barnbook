"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BreedersProChrome } from "@/components/breeders-pro/BreedersProChrome";
import { recordLiveCoverAction } from "@/app/(protected)/actions/breeding";

/* --------------------------------------------------------------------
 * Breeders Pro — Record Traditional Carry.
 *
 * Same form-density feel as the Record Flush page. Simpler flow:
 * no embryo count, no per-embryo rows, no flush concept. One mare
 * + one sire → one pregnancy.
 * ------------------------------------------------------------------ */

type HorseLite = {
  id: string;
  name: string;
  registration_number: string | null;
};

type MareMode = "existing" | "new";
type SireMode = "existing" | "new";

const COVER_METHODS = [
  { value: "pasture_cover", label: "Pasture Cover" },
  { value: "hand_cover", label: "Hand Cover" },
  { value: "vet_supervised", label: "Vet Supervised" },
] as const;

const breadcrumb = [
  { label: "Breeders Pro", href: "/breeders-pro" },
  { label: "Pregnancies", href: "/breeders-pro/pregnancies" },
  { label: "Record Traditional Carry" },
];

export function NewLiveCoverClient({
  mares,
  stallions,
  barnId,
}: {
  mares: HorseLite[];
  stallions: HorseLite[];
  barnId: string;
}) {
  const router = useRouter();

  // ---------- Mare (carrier / donor) ----------
  const [mareMode, setMareMode] = useState<MareMode>(
    mares.length > 0 ? "existing" : "new",
  );
  const [mareId, setMareId] = useState("");
  const [newMareName, setNewMareName] = useState("");
  const [newMareReg, setNewMareReg] = useState("");
  const [newMareBreed, setNewMareBreed] = useState("");
  const [newMareColor, setNewMareColor] = useState("");
  const [newMareFoalDate, setNewMareFoalDate] = useState("");
  const [mareAddToBarnbook, setMareAddToBarnbook] = useState(false);

  // ---------- Sire ----------
  const [sireMode, setSireMode] = useState<SireMode>(
    stallions.length > 0 ? "existing" : "new",
  );
  const [stallionId, setStallionId] = useState("");
  const [newSireName, setNewSireName] = useState("");
  const [newSireReg, setNewSireReg] = useState("");
  const [newSireBreed, setNewSireBreed] = useState("");
  const [newSireColor, setNewSireColor] = useState("");
  const [newSireFoalDate, setNewSireFoalDate] = useState("");
  const [sireAddToBarnbook, setSireAddToBarnbook] = useState(false);

  // ---------- Breeding category ----------
  type BreedingCategory = "live_cover" | "ai";
  type SemenType = "ai_fresh" | "ai_cooled" | "ai_frozen";

  const [breedingCategory, setBreedingCategory] = useState<BreedingCategory>("live_cover");

  // ---------- Cover details (Live Cover) ----------
  const [coverDate, setCoverDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [coverMethod, setCoverMethod] = useState("hand_cover");
  const [coverCount, setCoverCount] = useState("");

  // ---------- AI details ----------
  const [semenType, setSemenType] = useState<SemenType>("ai_fresh");
  const [semenSource, setSemenSource] = useState("");
  const [collectionDate, setCollectionDate] = useState("");
  const [inseminationTechnique, setInseminationTechnique] = useState("");
  const [semenVolume, setSemenVolume] = useState("");
  const [motility, setMotility] = useState("");
  const [semenDose, setSemenDose] = useState("");

  // ---------- Common details ----------
  const [veterinarian, setVeterinarian] = useState("");
  const [coverCost, setCoverCost] = useState("");
  const [notes, setNotes] = useState("");

  // ---------- Submit ----------
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    (mareMode === "existing" ? !!mareId : !!newMareName.trim()) &&
    (sireMode === "existing" ? !!stallionId : !!newSireName.trim()) &&
    !!coverDate;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setSaving(true);
    setError(null);

    const fd = new FormData();
    fd.set("barn_id", barnId);
    fd.set("mare_mode", mareMode);
    if (mareMode === "existing") {
      fd.set("mare_id", mareId);
    } else {
      fd.set("mare_name", newMareName);
      if (newMareReg) fd.set("mare_registration", newMareReg);
      if (newMareBreed) fd.set("mare_breed", newMareBreed);
      if (newMareColor) fd.set("mare_color", newMareColor);
      if (newMareFoalDate) fd.set("mare_foal_date", newMareFoalDate);
      if (mareAddToBarnbook) fd.set("mare_add_to_barnbook", "true");
    }
    fd.set("sire_mode", sireMode);
    if (sireMode === "existing") {
      fd.set("stallion_id", stallionId);
    } else {
      fd.set("sire_name", newSireName);
      if (newSireReg) fd.set("sire_registration", newSireReg);
      if (newSireBreed) fd.set("sire_breed", newSireBreed);
      if (newSireColor) fd.set("sire_color", newSireColor);
      if (newSireFoalDate) fd.set("sire_foal_date", newSireFoalDate);
      if (sireAddToBarnbook) fd.set("sire_add_to_barnbook", "true");
    }
    fd.set("breeding_category", breedingCategory);
    fd.set("cover_date", coverDate);

    if (breedingCategory === "live_cover") {
      if (coverMethod) fd.set("cover_method", coverMethod);
      if (coverCount) fd.set("cover_count", coverCount);
    } else {
      fd.set("semen_type", semenType);
      if (semenSource) fd.set("semen_source", semenSource);
      if (collectionDate) fd.set("collection_date", collectionDate);
      if (inseminationTechnique) fd.set("insemination_technique", inseminationTechnique);
      if (semenVolume) fd.set("semen_volume", semenVolume);
      if (motility) fd.set("motility_percent", motility);
      if (semenDose) fd.set("semen_dose", semenDose);
    }

    if (veterinarian) fd.set("veterinarian", veterinarian);
    if (coverCost) fd.set("cover_cost", coverCost);
    if (notes) fd.set("notes", notes);

    const result = await recordLiveCoverAction(fd);

    if (result.error) {
      setError(result.error);
      setSaving(false);
      return;
    }

    // Navigate to the new pregnancy
    if (result.pregnancyId) {
      router.push(`/breeders-pro/pregnancy/${result.pregnancyId}`);
    } else {
      router.push("/breeders-pro/pregnancies");
    }
  }

  return (
    <BreedersProChrome breadcrumb={breadcrumb}>
      <div className="bp-page-header">
        <h1 className="bp-display" style={{ fontSize: 32 }}>
          Record Traditional Carry
        </h1>
        <p style={{ color: "var(--bp-ink-secondary)", fontSize: 13, marginTop: 6 }}>
          Mare carries her own foal — live cover or AI. No embryos, no flush.
        </p>
      </div>

      <div className="px-4 md:px-8 pb-12" style={{ maxWidth: 720 }}>
        <form onSubmit={handleSubmit}>
          {error && (
            <div
              style={{
                padding: "10px 14px",
                marginBottom: 20,
                background: "#fef2f2",
                border: "1px solid #fca5a5",
                borderRadius: 4,
                color: "#991b1b",
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          {/* ============ MARE ============ */}
          <fieldset className="bp-fieldset">
            <legend className="bp-fieldset-legend">Mare</legend>

            <div className="bp-mode-toggle">
              <button
                type="button"
                className={`bp-chip ${mareMode === "existing" ? "bp-active" : ""}`}
                onClick={() => setMareMode("existing")}
                disabled={mares.length === 0}
              >
                Existing ({mares.length})
              </button>
              <button
                type="button"
                className={`bp-chip ${mareMode === "new" ? "bp-active" : ""}`}
                onClick={() => setMareMode("new")}
              >
                Add New
              </button>
            </div>

            {mareMode === "existing" ? (
              <div style={{ marginTop: 12 }}>
                <label className="bp-label">Mare being bred</label>
                <select
                  className="bp-select"
                  value={mareId}
                  onChange={(e) => setMareId(e.target.value)}
                  required={mareMode === "existing"}
                >
                  <option value="">Select mare...</option>
                  {mares.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                      {m.registration_number ? ` (${m.registration_number})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div style={{ marginTop: 12 }}>
                <label className="bp-label">Name *</label>
                <input
                  className="bp-input"
                  value={newMareName}
                  onChange={(e) => setNewMareName(e.target.value)}
                  placeholder="Mare name"
                  required={mareMode === "new"}
                />
                <div className="bp-field-row" style={{ marginTop: 10 }}>
                  <div>
                    <label className="bp-label">Registration</label>
                    <input
                      className="bp-input"
                      value={newMareReg}
                      onChange={(e) => setNewMareReg(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                  <div>
                    <label className="bp-label">Breed</label>
                    <input
                      className="bp-input"
                      value={newMareBreed}
                      onChange={(e) => setNewMareBreed(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                  <div>
                    <label className="bp-label">Color</label>
                    <input
                      className="bp-input"
                      value={newMareColor}
                      onChange={(e) => setNewMareColor(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                </div>
                <div style={{ marginTop: 10 }}>
                  <label className="bp-label">Year Foaled</label>
                  <input
                    className="bp-input"
                    type="date"
                    value={newMareFoalDate}
                    onChange={(e) => setNewMareFoalDate(e.target.value)}
                    style={{ maxWidth: 200 }}
                  />
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 13, color: "var(--bp-ink-secondary)", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={mareAddToBarnbook}
                    onChange={(e) => setMareAddToBarnbook(e.target.checked)}
                    style={{ accentColor: "var(--bp-accent)" }}
                  />
                  Also add to BarnBook horse list
                </label>
              </div>
            )}
          </fieldset>

          {/* ============ SIRE ============ */}
          <fieldset className="bp-fieldset">
            <legend className="bp-fieldset-legend">Sire</legend>

            <div className="bp-mode-toggle">
              <button
                type="button"
                className={`bp-chip ${sireMode === "existing" ? "bp-active" : ""}`}
                onClick={() => setSireMode("existing")}
                disabled={stallions.length === 0}
              >
                Existing ({stallions.length})
              </button>
              <button
                type="button"
                className={`bp-chip ${sireMode === "new" ? "bp-active" : ""}`}
                onClick={() => setSireMode("new")}
              >
                Add New
              </button>
            </div>

            {sireMode === "existing" ? (
              <div style={{ marginTop: 12 }}>
                <label className="bp-label">Stallion</label>
                <select
                  className="bp-select"
                  value={stallionId}
                  onChange={(e) => setStallionId(e.target.value)}
                  required={sireMode === "existing"}
                >
                  <option value="">Select stallion...</option>
                  {stallions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.registration_number
                        ? ` (${s.registration_number})`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div style={{ marginTop: 12 }}>
                <label className="bp-label">Name *</label>
                <input
                  className="bp-input"
                  value={newSireName}
                  onChange={(e) => setNewSireName(e.target.value)}
                  placeholder="Stallion name"
                  required={sireMode === "new"}
                />
                <div className="bp-field-row" style={{ marginTop: 10 }}>
                  <div>
                    <label className="bp-label">Registration</label>
                    <input
                      className="bp-input"
                      value={newSireReg}
                      onChange={(e) => setNewSireReg(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                  <div>
                    <label className="bp-label">Breed</label>
                    <input
                      className="bp-input"
                      value={newSireBreed}
                      onChange={(e) => setNewSireBreed(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                  <div>
                    <label className="bp-label">Color</label>
                    <input
                      className="bp-input"
                      value={newSireColor}
                      onChange={(e) => setNewSireColor(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                </div>
                <div style={{ marginTop: 10 }}>
                  <label className="bp-label">Year Foaled</label>
                  <input
                    className="bp-input"
                    type="date"
                    value={newSireFoalDate}
                    onChange={(e) => setNewSireFoalDate(e.target.value)}
                    style={{ maxWidth: 200 }}
                  />
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 13, color: "var(--bp-ink-secondary)", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={sireAddToBarnbook}
                    onChange={(e) => setSireAddToBarnbook(e.target.checked)}
                    style={{ accentColor: "var(--bp-accent)" }}
                  />
                  Also add to BarnBook horse list
                </label>
              </div>
            )}
          </fieldset>

          {/* ============ BREEDING DETAILS ============ */}
          <fieldset className="bp-fieldset">
            <legend className="bp-fieldset-legend">Breeding Details</legend>

            {/* -- Category toggle -- */}
            <label className="bp-label">Breeding Method</label>
            <div className="bp-mode-toggle">
              <button
                type="button"
                className={`bp-chip ${breedingCategory === "live_cover" ? "bp-active" : ""}`}
                onClick={() => setBreedingCategory("live_cover")}
              >
                Live Cover
              </button>
              <button
                type="button"
                className={`bp-chip ${breedingCategory === "ai" ? "bp-active" : ""}`}
                onClick={() => setBreedingCategory("ai")}
              >
                Artificial Insemination
              </button>
            </div>

            {breedingCategory === "live_cover" ? (
              /* ---------- Live Cover fields ---------- */
              <div style={{ marginTop: 16 }}>
                <div className="bp-field-row">
                  <div>
                    <label className="bp-label">Cover Date *</label>
                    <input
                      className="bp-input"
                      type="date"
                      value={coverDate}
                      onChange={(e) => setCoverDate(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="bp-label">Cover Method</label>
                    <select
                      className="bp-select"
                      value={coverMethod}
                      onChange={(e) => setCoverMethod(e.target.value)}
                    >
                      {COVER_METHODS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="bp-label">Number of Covers</label>
                    <input
                      className="bp-input"
                      type="number"
                      min="1"
                      max="20"
                      value={coverCount}
                      onChange={(e) => setCoverCount(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* ---------- AI fields ---------- */
              <div style={{ marginTop: 16 }}>
                <label className="bp-label">Semen Type</label>
                <div className="bp-mode-toggle" style={{ marginBottom: 12 }}>
                  <button
                    type="button"
                    className={`bp-chip ${semenType === "ai_fresh" ? "bp-active" : ""}`}
                    onClick={() => setSemenType("ai_fresh")}
                  >
                    Fresh
                  </button>
                  <button
                    type="button"
                    className={`bp-chip ${semenType === "ai_cooled" ? "bp-active" : ""}`}
                    onClick={() => setSemenType("ai_cooled")}
                  >
                    Cooled
                  </button>
                  <button
                    type="button"
                    className={`bp-chip ${semenType === "ai_frozen" ? "bp-active" : ""}`}
                    onClick={() => setSemenType("ai_frozen")}
                  >
                    Frozen
                  </button>
                </div>

                <div className="bp-field-row">
                  <div>
                    <label className="bp-label">Insemination Date *</label>
                    <input
                      className="bp-input"
                      type="date"
                      value={coverDate}
                      onChange={(e) => setCoverDate(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="bp-label">Technique</label>
                    <select
                      className="bp-select"
                      value={inseminationTechnique}
                      onChange={(e) => setInseminationTechnique(e.target.value)}
                    >
                      <option value="">Select...</option>
                      <option value="standard_uterine">Standard Uterine</option>
                      <option value="deep_horn">Deep Horn</option>
                      <option value="hysteroscopic">Hysteroscopic</option>
                    </select>
                  </div>
                  <div>
                    <label className="bp-label">Collection Date</label>
                    <input
                      className="bp-input"
                      type="date"
                      value={collectionDate}
                      onChange={(e) => setCollectionDate(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <label className="bp-label">Semen Source / Shipper</label>
                  <input
                    className="bp-input"
                    value={semenSource}
                    onChange={(e) => setSemenSource(e.target.value)}
                    placeholder="Facility or shipper name"
                  />
                </div>

                <div className="bp-field-row" style={{ marginTop: 12 }}>
                  <div>
                    <label className="bp-label">Volume (mL)</label>
                    <input
                      className="bp-input"
                      type="number"
                      min="0"
                      step="0.1"
                      value={semenVolume}
                      onChange={(e) => setSemenVolume(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                  <div>
                    <label className="bp-label">Motility %</label>
                    <input
                      className="bp-input"
                      type="number"
                      min="0"
                      max="100"
                      value={motility}
                      onChange={(e) => setMotility(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                  <div>
                    <label className="bp-label">Dose / Concentration</label>
                    <input
                      className="bp-input"
                      value={semenDose}
                      onChange={(e) => setSemenDose(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ---------- Common fields ---------- */}
            <div className="bp-field-row" style={{ marginTop: 16 }}>
              <div>
                <label className="bp-label">Veterinarian</label>
                <input
                  className="bp-input"
                  value={veterinarian}
                  onChange={(e) => setVeterinarian(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="bp-label">Cost</label>
                <input
                  className="bp-input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={coverCost}
                  onChange={(e) => setCoverCost(e.target.value)}
                  placeholder="$0.00"
                />
              </div>
              <div />
            </div>

            <div style={{ marginTop: 12 }}>
              <label className="bp-label">Notes</label>
              <textarea
                className="bp-input"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes about this breeding"
                style={{ resize: "vertical" }}
              />
            </div>
          </fieldset>

          {/* ============ SUBMIT ============ */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginTop: 24,
            }}
          >
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
              disabled={!canSubmit || saving}
            >
              {saving ? "Saving..." : "Record Traditional Carry"}
            </button>
          </div>
        </form>
      </div>
    </BreedersProChrome>
  );
}
