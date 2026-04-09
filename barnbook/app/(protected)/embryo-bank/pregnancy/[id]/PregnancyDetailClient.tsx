"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Pregnancy, Foaling } from "@/lib/types";
import {
  PREGNANCY_STATUS_LABELS,
  PREGNANCY_CHECK_LABELS,
  PREGNANCY_CHECKS,
  FOALING_TYPES,
  FOALING_TYPE_LABELS,
} from "@/lib/horse-form-constants";
import {
  logPregnancyCheckAction,
  recordFoalingAction,
  confirmSurvivalAction,
} from "@/app/(protected)/actions/pregnancy";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

function statusColor(status: string): string {
  switch (status) {
    case "pending_check": return "bg-amber-100 text-amber-800";
    case "confirmed": return "bg-green-100 text-green-800";
    case "foaled": return "bg-brass-gold/20 text-barn-dark";
    case "lost_early":
    case "lost_late":
    case "aborted": return "bg-red-100 text-red-800";
    default: return "bg-gray-100 text-gray-800";
  }
}

function checkIcon(value: string): string {
  switch (value) {
    case "confirmed": return "text-green-600";
    case "not_pregnant": return "text-red-600";
    case "pending": return "text-amber-500";
    default: return "text-barn-dark/30";
  }
}

function checkLabel(value: string): string {
  switch (value) {
    case "confirmed": return "Confirmed";
    case "not_pregnant": return "Not Pregnant";
    case "pending": return "Pending";
    case "not_done": return "Not Done";
    default: return value;
  }
}

export function PregnancyDetailClient({
  pregnancy,
  horseNames,
  canEdit,
  foaling,
}: {
  pregnancy: Pregnancy;
  horseNames: Record<string, string>;
  canEdit: boolean;
  foaling: Foaling | null;
}) {
  const router = useRouter();
  const [checkModal, setCheckModal] = useState<string | null>(null);
  const [showFoalingModal, setShowFoalingModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const surrogateName = horseNames[pregnancy.surrogate_horse_id] ?? "Unknown";
  const donorName = pregnancy.donor_horse_id ? (horseNames[pregnancy.donor_horse_id] ?? "Unknown") : "Unknown";
  const stallionName = pregnancy.stallion_horse_id ? (horseNames[pregnancy.stallion_horse_id] ?? "Unknown") : "External";

  const daysPregnant = Math.floor(
    (Date.now() - new Date(pregnancy.transfer_date).getTime()) / (1000 * 60 * 60 * 24)
  );
  const daysToFoal = pregnancy.expected_foaling_date
    ? Math.floor((new Date(pregnancy.expected_foaling_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const isActive = pregnancy.status === "pending_check" || pregnancy.status === "confirmed";
  const canRecordFoaling = isActive && !foaling;

  // 30-day survival: foaling exists, foal alive, 30+ days past, not yet confirmed
  const foalDaysOld = foaling
    ? Math.floor((Date.now() - new Date(foaling.foaling_date).getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const canConfirmSurvival = foaling
    && foaling.foal_alive_at_24hr !== false
    && foaling.foal_alive_at_30d !== true
    && foalDaysOld >= 30;

  async function handleCheckSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const result = await logPregnancyCheckAction(pregnancy.id, formData);
    if (result.error) {
      setError(result.error);
      setSaving(false);
      return;
    }
    setCheckModal(null);
    setSaving(false);
    router.refresh();
  }

  async function handleFoalingSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const result = await recordFoalingAction(pregnancy.id, formData);
    if (result.error) {
      setError(result.error);
      setSaving(false);
      return;
    }
    setShowFoalingModal(false);
    setSaving(false);
    router.refresh();
  }

  async function handleConfirmSurvival() {
    if (!foaling) return;
    setSaving(true);
    const result = await confirmSurvivalAction(foaling.id);
    if (result.error) {
      setError(result.error);
    }
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <Link
        href="/embryo-bank"
        className="inline-flex items-center gap-1 text-sm text-barn-dark/50 hover:text-barn-dark transition"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
        Embryo Bank
      </Link>

      {/* Header */}
      <div className="mt-4 flex items-start justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-barn-dark">Pregnancy</h1>
          <p className="mt-1 text-sm text-barn-dark/60">
            Surrogate:{" "}
            <Link href={`/horses/${pregnancy.surrogate_horse_id}`} className="hover:text-brass-gold transition">
              {surrogateName}
            </Link>
          </p>
          <p className="text-sm text-barn-dark/50">
            {donorName} x {stallionName}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-medium ${statusColor(pregnancy.status)}`}>
          {PREGNANCY_STATUS_LABELS[pregnancy.status]}
        </span>
      </div>

      {/* Key dates */}
      <div className="mt-6 rounded-xl border border-barn-dark/10 bg-white p-5 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium text-barn-dark/50">Transfer Date</p>
            <p className="text-sm text-barn-dark">{new Date(pregnancy.transfer_date).toLocaleDateString()}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-barn-dark/50">Days Pregnant</p>
            <p className="text-sm text-barn-dark">{daysPregnant} days</p>
          </div>
          {pregnancy.expected_foaling_date && (
            <div>
              <p className="text-xs font-medium text-barn-dark/50">Expected Foaling</p>
              <p className="text-sm text-barn-dark">
                {new Date(pregnancy.expected_foaling_date).toLocaleDateString()}
                {daysToFoal != null && daysToFoal > 0 && (
                  <span className="ml-1 text-xs text-barn-dark/40">({daysToFoal}d)</span>
                )}
              </p>
            </div>
          )}
        </div>
        {pregnancy.notes && (
          <div className="mt-3 border-t border-barn-dark/10 pt-3">
            <p className="text-xs font-medium text-barn-dark/50">Notes</p>
            <p className="text-sm text-barn-dark">{pregnancy.notes}</p>
          </div>
        )}
      </div>

      {/* Pregnancy checks */}
      <div className="mt-4 rounded-xl border border-barn-dark/10 bg-white p-5 shadow-sm">
        <h3 className="text-xs font-semibold text-barn-dark/60 uppercase tracking-wide">Pregnancy Checks</h3>
        <div className="mt-3 space-y-2">
          {PREGNANCY_CHECKS.map((check) => {
            const value = pregnancy[check] ?? "not_done";
            return (
              <div key={check} className="flex items-center justify-between rounded-lg border border-barn-dark/5 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${checkIcon(value)}`}>
                    {value === "confirmed" ? "\u2713" : value === "not_pregnant" ? "\u2717" : "\u25CB"}
                  </span>
                  <span className="text-sm text-barn-dark">{PREGNANCY_CHECK_LABELS[check]}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-barn-dark/50">{checkLabel(value)}</span>
                  {canEdit && isActive && (value === "pending" || value === "not_done") && (
                    <button
                      type="button"
                      onClick={() => setCheckModal(check)}
                      className="rounded-lg bg-brass-gold/10 px-2.5 py-1 text-xs font-medium text-brass-gold hover:bg-brass-gold/20 transition"
                    >
                      Log
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Foaling info */}
      {foaling && (
        <div className="mt-4 rounded-xl border border-barn-dark/10 bg-white p-5 shadow-sm">
          <h3 className="text-xs font-semibold text-barn-dark/60 uppercase tracking-wide">Foaling</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-barn-dark/50">Date</p>
              <p className="text-sm text-barn-dark">{new Date(foaling.foaling_date).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-xs text-barn-dark/50">Type</p>
              <p className="text-sm text-barn-dark">{FOALING_TYPE_LABELS[foaling.foaling_type]}</p>
            </div>
            <div>
              <p className="text-xs text-barn-dark/50">Sex</p>
              <p className="text-sm text-barn-dark capitalize">{foaling.foal_sex}</p>
            </div>
            {foaling.foal_color && (
              <div>
                <p className="text-xs text-barn-dark/50">Color</p>
                <p className="text-sm text-barn-dark">{foaling.foal_color}</p>
              </div>
            )}
            {foaling.foal_horse_id && (
              <div className="sm:col-span-2">
                <Link
                  href={`/horses/${foaling.foal_horse_id}`}
                  className="inline-flex items-center gap-1 text-sm text-brass-gold hover:underline"
                >
                  View Foal Profile
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
              </div>
            )}
          </div>

          {canEdit && canConfirmSurvival && (
            <div className="mt-4 border-t border-barn-dark/10 pt-4">
              <Button variant="primary" onClick={handleConfirmSurvival} disabled={saving}>
                {saving ? "Confirming..." : "Confirm 30-Day Survival"}
              </Button>
            </div>
          )}

          {foaling.foal_alive_at_30d && (
            <div className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
              30-day survival confirmed
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      {canEdit && canRecordFoaling && (
        <div className="mt-4">
          <Button variant="primary" onClick={() => setShowFoalingModal(true)}>
            Record Foaling
          </Button>
        </div>
      )}

      {/* Check modal */}
      {checkModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          onClick={() => setCheckModal(null)}
        >
          <div className="fixed inset-0 bg-black/40" />
          <div
            className="relative z-10 w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-barn-dark">
              {PREGNANCY_CHECK_LABELS[checkModal]}
            </h2>
            {error && <div className="mt-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
            <form onSubmit={handleCheckSubmit} className="mt-4 space-y-4">
              <input type="hidden" name="check_field" value={checkModal} />
              <Select name="check_result" label="Result" defaultValue="confirmed">
                <option value="confirmed">Confirmed Pregnant</option>
                <option value="not_pregnant">Not Pregnant</option>
              </Select>
              <Input
                name="check_date"
                label="Date"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => setCheckModal(null)} block>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={saving} block>
                  {saving ? "Saving..." : "Log Check"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Foaling modal */}
      {showFoalingModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          onClick={() => setShowFoalingModal(false)}
        >
          <div className="fixed inset-0 bg-black/40" />
          <div
            className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-barn-dark">Record Foaling</h2>
            <p className="text-sm text-barn-dark/50">Surrogate: {surrogateName}</p>
            {error && <div className="mt-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
            <form onSubmit={handleFoalingSubmit} className="mt-4 space-y-4">
              <Input
                name="foal_date"
                label="Foal Date"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Select name="foal_sex" label="Sex">
                  <option value="colt">Colt</option>
                  <option value="filly">Filly</option>
                </Select>
                <Input name="foal_color" label="Color" placeholder="Bay, Sorrel, etc." />
              </div>
              <Input name="foal_name" label="Foal Name" placeholder="Optional" />
              <Select name="foaling_type" label="Foaling Type" defaultValue="normal">
                {FOALING_TYPES.map((t) => (
                  <option key={t} value={t}>{FOALING_TYPE_LABELS[t]}</option>
                ))}
              </Select>
              <Input name="veterinarian_name" label="Veterinarian" placeholder="Dr. Smith" />
              <div>
                <label className="mb-1.5 block text-xs font-medium text-barn-dark/70">Complications</label>
                <textarea
                  name="complications"
                  rows={2}
                  className="w-full rounded-xl border border-barn-dark/15 bg-white px-3 py-2.5 text-sm text-barn-dark placeholder:text-barn-dark/35 focus:border-brass-gold focus:outline-none focus:ring-2 focus:ring-brass-gold/30"
                  placeholder="Any complications..."
                />
              </div>
              <div className="flex items-center gap-2">
                <input type="hidden" name="foal_alive" value="true" />
                <label className="flex items-center gap-2 text-sm text-barn-dark">
                  <input
                    type="checkbox"
                    name="create_horse_profile"
                    value="true"
                    defaultChecked
                    className="rounded border-barn-dark/30"
                  />
                  Create horse profile for foal
                </label>
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => setShowFoalingModal(false)} block>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={saving} block>
                  {saving ? "Recording..." : "Record Foaling"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
