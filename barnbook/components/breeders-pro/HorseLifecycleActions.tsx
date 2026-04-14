"use client";

/**
 * Breeders Pro — Horse Lifecycle Actions.
 *
 * A role-agnostic set of actions that applies to any horse in the
 * program:
 *
 *   - Record Foaling             (requires an active pregnancy)
 *   - Record Pregnancy Loss      (requires an active pregnancy)
 *   - Update Location            (always)
 *   - Mark Sold                  (if not already dispositioned)
 *   - Mark Died                  (if not already dispositioned)
 *   - Retire from Program        (if not already dispositioned)
 *   - Return to Program          (if currently dispositioned)
 *
 * Pregnancy-driven actions look up the horse's active pregnancy and
 * operate on it. This means the same component will work unchanged
 * for donor mares carrying live-cover pregnancies in the future —
 * "foaling" is always about closing out whichever pregnancy the mare
 * currently has, not about which role she plays in the program.
 *
 * Each action opens a small modal with fields, submits via server
 * action, and the parent page's revalidatePath calls refresh the UI.
 */

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Horse, Location, Pregnancy } from "@/lib/types";
import {
  moveHorseToLocationAction,
  recordHorseDispositionAction,
  unarchiveHorseAction,
  recordPregnancyLossAction,
} from "@/app/(protected)/actions/horse-lifecycle";
import { recordFoalingAction } from "@/app/(protected)/actions/pregnancy";

type ModalKey =
  | "foaling"
  | "loss"
  | "location"
  | "sold"
  | "died"
  | "retire"
  | "unarchive"
  | null;

export function HorseLifecycleActions({
  horse,
  activePregnancy,
  facilities,
}: {
  horse: Horse;
  /** The horse's currently active pregnancy, if any. Used to enable
   *  Record Foaling / Record Pregnancy Loss. */
  activePregnancy: Pregnancy | null;
  /** List of non-archived facilities in this barn for the Update
   *  Location picker. */
  facilities: Location[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState<ModalKey>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [locationMode, setLocationMode] = useState<"existing" | "new">(
    facilities.length > 0 ? "existing" : "new",
  );

  const isDispositioned = !!horse.disposition;
  const hasActivePregnancy = !!activePregnancy;

  function close() {
    if (pending) return;
    setOpen(null);
    setError(null);
  }

  function runAction(handler: () => Promise<{ error?: string } | undefined>) {
    setError(null);
    startTransition(async () => {
      const result = await handler();
      if (result?.error) {
        setError(result.error);
        return;
      }
      setOpen(null);
      router.refresh();
    });
  }

  // ---------- Submit handlers ----------

  function handleFoaling(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!activePregnancy) return;
    const fd = new FormData(e.currentTarget);
    runAction(() => recordFoalingAction(activePregnancy.id, fd));
  }

  function handleLoss(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!activePregnancy) return;
    const fd = new FormData(e.currentTarget);
    runAction(() => recordPregnancyLossAction(activePregnancy.id, fd));
  }

  function handleLocation(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("location_mode", locationMode);
    runAction(() => moveHorseToLocationAction(horse.id, fd));
  }

  function handleDisposition(
    e: FormEvent<HTMLFormElement>,
    type: "sold" | "died" | "retired",
  ) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("disposition", type);
    runAction(() => recordHorseDispositionAction(horse.id, fd));
  }

  function handleUnarchive() {
    runAction(() => unarchiveHorseAction(horse.id));
  }

  // ---------- Button bar ----------

  return (
    <>
      <div
        className="bp-actions-menu"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          justifyContent: "flex-end",
        }}
      >
        {!isDispositioned && (
          <>
            {hasActivePregnancy && (
              <>
                <button
                  type="button"
                  className="bp-btn bp-primary"
                  onClick={() => setOpen("foaling")}
                >
                  Record Foaling
                </button>
                <button
                  type="button"
                  className="bp-btn"
                  onClick={() => setOpen("loss")}
                >
                  Record Loss
                </button>
              </>
            )}
            <button
              type="button"
              className="bp-btn"
              onClick={() => {
                setLocationMode(facilities.length > 0 ? "existing" : "new");
                setOpen("location");
              }}
            >
              Update Location
            </button>
            <button
              type="button"
              className="bp-btn"
              onClick={() => setOpen("sold")}
            >
              Mark Sold
            </button>
            <button
              type="button"
              className="bp-btn"
              onClick={() => setOpen("died")}
            >
              Mark Died
            </button>
            <button
              type="button"
              className="bp-btn"
              onClick={() => setOpen("retire")}
            >
              Retire
            </button>
          </>
        )}
        {isDispositioned && (
          <button
            type="button"
            className="bp-btn"
            onClick={() => setOpen("unarchive")}
          >
            Return to Program
          </button>
        )}
      </div>

      {/* ============== MODAL SHELL ============== */}
      {open !== null && (
        <div className="bp-modal-overlay" onClick={close}>
          <div
            className="bp-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bp-modal-header">
              <div className="bp-modal-title">{MODAL_TITLE[open]}</div>
              <button
                type="button"
                className="bp-modal-close"
                aria-label="Close"
                onClick={close}
              >
                ×
              </button>
            </div>

            {error && <div className="bp-modal-error">{error}</div>}

            {/* ============== FOALING ============== */}
            {open === "foaling" && activePregnancy && (
              <form onSubmit={handleFoaling}>
                <div className="bp-modal-body">
                  <div className="bp-field-hint">
                    Closes out the active pregnancy and records a foaling
                    event. The mare becomes available again.
                  </div>
                  <div className="bp-field">
                    <label className="bp-field-label">Foaling Date</label>
                    <input
                      type="date"
                      name="foal_date"
                      className="bp-input"
                      defaultValue={new Date().toISOString().slice(0, 10)}
                      required
                    />
                  </div>
                  <div className="bp-field-row">
                    <div className="bp-field">
                      <label className="bp-field-label">Foal Sex</label>
                      <select
                        name="foal_sex"
                        className="bp-select"
                        defaultValue=""
                      >
                        <option value="">—</option>
                        <option value="colt">Colt</option>
                        <option value="filly">Filly</option>
                      </select>
                    </div>
                    <div className="bp-field">
                      <label className="bp-field-label">Foal Color</label>
                      <input
                        type="text"
                        name="foal_color"
                        className="bp-input"
                      />
                    </div>
                  </div>
                  <div className="bp-field">
                    <label className="bp-field-label">Foal Name</label>
                    <input
                      type="text"
                      name="foal_name"
                      className="bp-input"
                      placeholder="Optional"
                    />
                  </div>
                  <div className="bp-field">
                    <label className="bp-field-label">Foaling Type</label>
                    <select
                      name="foaling_type"
                      className="bp-select"
                      defaultValue="normal"
                    >
                      <option value="normal">Normal</option>
                      <option value="assisted">Assisted</option>
                      <option value="c_section">C-Section</option>
                      <option value="dystocia">Dystocia</option>
                    </select>
                  </div>
                  <div className="bp-field">
                    <label className="bp-field-label">Veterinarian</label>
                    <input
                      type="text"
                      name="veterinarian_name"
                      className="bp-input"
                      placeholder="Dr. Smith"
                    />
                  </div>
                  <div className="bp-field">
                    <label className="bp-field-label">Complications</label>
                    <textarea
                      name="complications"
                      rows={2}
                      className="bp-textarea"
                      placeholder="Optional"
                    />
                  </div>
                  <label
                    className="bp-checkbox-row"
                    style={{ marginTop: 4 }}
                  >
                    <input
                      type="checkbox"
                      name="create_horse_profile"
                      value="true"
                      defaultChecked
                    />
                    <span>Create foal horse profile</span>
                  </label>
                </div>
                <ModalFooter pending={pending} onCancel={close} label="Record Foaling" />
              </form>
            )}

            {/* ============== LOSS ============== */}
            {open === "loss" && activePregnancy && (
              <form onSubmit={handleLoss}>
                <div className="bp-modal-body">
                  <div className="bp-field-hint">
                    Records pregnancy loss. The embryo is marked lost and
                    the mare becomes available again.
                  </div>
                  <div className="bp-field">
                    <label className="bp-field-label">Loss Type</label>
                    <select
                      name="loss_type"
                      className="bp-select"
                      defaultValue="early"
                      required
                    >
                      <option value="early">Early (before day 60)</option>
                      <option value="late">Late (day 60 or after)</option>
                      <option value="aborted">Aborted</option>
                    </select>
                  </div>
                  <div className="bp-field">
                    <label className="bp-field-label">Loss Date</label>
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
                      name="notes"
                      rows={3}
                      className="bp-textarea"
                      placeholder="Optional"
                    />
                  </div>
                </div>
                <ModalFooter pending={pending} onCancel={close} label="Record Loss" />
              </form>
            )}

            {/* ============== LOCATION ============== */}
            {open === "location" && (
              <form onSubmit={handleLocation}>
                <div className="bp-modal-body">
                  <div className="bp-field-hint">
                    Moves the mare to a facility. Previous assignment is
                    closed out and preserved in history.
                  </div>

                  {/* Mode toggle */}
                  <div className="bp-filters" style={{ marginBottom: 4 }}>
                    <button
                      type="button"
                      className={`bp-chip ${locationMode === "existing" ? "bp-active" : ""}`}
                      onClick={() =>
                        facilities.length > 0 && setLocationMode("existing")
                      }
                      disabled={facilities.length === 0}
                      style={
                        facilities.length === 0
                          ? { opacity: 0.4, cursor: "not-allowed" }
                          : undefined
                      }
                    >
                      Existing facility ({facilities.length})
                    </button>
                    <button
                      type="button"
                      className={`bp-chip ${locationMode === "new" ? "bp-active" : ""}`}
                      onClick={() => setLocationMode("new")}
                    >
                      Add new facility
                    </button>
                  </div>

                  {locationMode === "existing" ? (
                    <div className="bp-field">
                      <label className="bp-field-label">Facility</label>
                      <select
                        name="location_id"
                        className="bp-select"
                        required={locationMode === "existing"}
                        defaultValue=""
                      >
                        <option value="">Select facility…</option>
                        {facilities.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.facility_name}
                            {f.city ? ` · ${f.city}` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <>
                      <div className="bp-field">
                        <label className="bp-field-label">
                          Facility Name *
                        </label>
                        <input
                          type="text"
                          name="facility_name"
                          className="bp-input"
                          placeholder="North Ranch"
                          required={locationMode === "new"}
                        />
                      </div>
                      <div className="bp-field">
                        <label className="bp-field-label">Address</label>
                        <input
                          type="text"
                          name="address_line_1"
                          className="bp-input"
                          placeholder="Street"
                        />
                      </div>
                      <div className="bp-field-row">
                        <div className="bp-field">
                          <label className="bp-field-label">City</label>
                          <input
                            type="text"
                            name="city"
                            className="bp-input"
                          />
                        </div>
                        <div className="bp-field">
                          <label className="bp-field-label">State</label>
                          <input
                            type="text"
                            name="state_province"
                            className="bp-input"
                          />
                        </div>
                        <div className="bp-field">
                          <label className="bp-field-label">Postal</label>
                          <input
                            type="text"
                            name="postal_code"
                            className="bp-input"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  <div className="bp-field">
                    <label className="bp-field-label">Start Date</label>
                    <input
                      type="date"
                      name="started_at"
                      className="bp-input"
                      defaultValue={new Date().toISOString().slice(0, 10)}
                      required
                    />
                  </div>
                  <div className="bp-field">
                    <label className="bp-field-label">
                      Note (pasture, stall, etc.)
                    </label>
                    <input
                      type="text"
                      name="assignment_note"
                      className="bp-input"
                      placeholder="Foaling barn 2, east pasture, etc."
                    />
                  </div>
                </div>
                <ModalFooter pending={pending} onCancel={close} label="Move Horse" />
              </form>
            )}

            {/* ============== SOLD ============== */}
            {open === "sold" && (
              <form onSubmit={(e) => handleDisposition(e, "sold")}>
                <div className="bp-modal-body">
                  <div className="bp-field-hint">
                    Archives the mare and records the sale. Location
                    assignment will be closed out.
                  </div>
                  <div className="bp-field">
                    <label className="bp-field-label">Sale Date</label>
                    <input
                      type="date"
                      name="disposition_date"
                      className="bp-input"
                      defaultValue={new Date().toISOString().slice(0, 10)}
                      required
                    />
                  </div>
                  <div className="bp-field">
                    <label className="bp-field-label">Sold To</label>
                    <input
                      type="text"
                      name="sold_to"
                      className="bp-input"
                      placeholder="Buyer name or barn"
                    />
                  </div>
                  <div className="bp-field">
                    <label className="bp-field-label">Sale Price (USD)</label>
                    <input
                      type="number"
                      name="sale_price"
                      className="bp-input"
                      step="0.01"
                      min="0"
                      placeholder="Optional"
                    />
                  </div>
                  <div className="bp-field">
                    <label className="bp-field-label">Notes</label>
                    <textarea
                      name="notes"
                      rows={3}
                      className="bp-textarea"
                      placeholder="Optional"
                    />
                  </div>
                </div>
                <ModalFooter pending={pending} onCancel={close} label="Mark Sold" />
              </form>
            )}

            {/* ============== DIED ============== */}
            {open === "died" && (
              <form onSubmit={(e) => handleDisposition(e, "died")}>
                <div className="bp-modal-body">
                  <div className="bp-field-hint">
                    Archives the mare and records the date. Location
                    assignment will be closed out.
                  </div>
                  <div className="bp-field">
                    <label className="bp-field-label">Date of Death</label>
                    <input
                      type="date"
                      name="disposition_date"
                      className="bp-input"
                      defaultValue={new Date().toISOString().slice(0, 10)}
                      required
                    />
                  </div>
                  <div className="bp-field">
                    <label className="bp-field-label">
                      Cause / Notes
                    </label>
                    <textarea
                      name="notes"
                      rows={3}
                      className="bp-textarea"
                      placeholder="Optional"
                    />
                  </div>
                </div>
                <ModalFooter pending={pending} onCancel={close} label="Mark Died" />
              </form>
            )}

            {/* ============== RETIRE ============== */}
            {open === "retire" && (
              <form onSubmit={(e) => handleDisposition(e, "retired")}>
                <div className="bp-modal-body">
                  <div className="bp-field-hint">
                    Removes the mare from active pickers. She stays in the
                    records but won&apos;t appear as a surrogate option.
                  </div>
                  <div className="bp-field">
                    <label className="bp-field-label">
                      Retirement Date
                    </label>
                    <input
                      type="date"
                      name="disposition_date"
                      className="bp-input"
                      defaultValue={new Date().toISOString().slice(0, 10)}
                      required
                    />
                  </div>
                  <div className="bp-field">
                    <label className="bp-field-label">Reason / Notes</label>
                    <textarea
                      name="notes"
                      rows={3}
                      className="bp-textarea"
                      placeholder="Optional"
                    />
                  </div>
                </div>
                <ModalFooter pending={pending} onCancel={close} label="Retire" />
              </form>
            )}

            {/* ============== UNARCHIVE ============== */}
            {open === "unarchive" && (
              <div>
                <div className="bp-modal-body">
                  <div className="bp-field-hint">
                    Returns the mare to active status. Disposition record
                    is cleared. You&apos;ll need to set a new location
                    separately.
                  </div>
                </div>
                <div className="bp-modal-footer">
                  <button
                    type="button"
                    className="bp-btn"
                    onClick={close}
                    disabled={pending}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="bp-btn bp-primary"
                    onClick={handleUnarchive}
                    disabled={pending}
                  >
                    {pending ? "Working…" : "Return to Program"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

const MODAL_TITLE: Record<Exclude<ModalKey, null>, string> = {
  foaling: "Record Foaling",
  loss: "Record Pregnancy Loss",
  location: "Update Location",
  sold: "Mark Sold",
  died: "Mark Died",
  retire: "Retire from Program",
  unarchive: "Return to Program",
};

function ModalFooter({
  pending,
  onCancel,
  label,
}: {
  pending: boolean;
  onCancel: () => void;
  label: string;
}) {
  return (
    <div className="bp-modal-footer">
      <button
        type="button"
        className="bp-btn"
        onClick={onCancel}
        disabled={pending}
      >
        Cancel
      </button>
      <button
        type="submit"
        className="bp-btn bp-primary"
        disabled={pending}
      >
        {pending ? "Working…" : label}
      </button>
    </div>
  );
}
