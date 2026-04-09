"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createFlushAction } from "@/app/(protected)/actions/embryo";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
  BREEDING_METHOD_VALUES,
  BREEDING_METHOD_LABELS,
  EMBRYO_GRADES,
  EMBRYO_GRADE_LABELS,
  EMBRYO_STAGES,
  EMBRYO_STAGE_LABELS,
} from "@/lib/horse-form-constants";

interface Horse {
  id: string;
  name: string;
}

interface FlushFormProps {
  donorHorseId: string;
  donorName: string;
  barnStallions: Horse[];
  onClose: () => void;
}

export function FlushForm({ donorHorseId, donorName, barnStallions, onClose }: FlushFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stallionSource, setStallionSource] = useState<"in_system" | "external">(
    barnStallions.length > 0 ? "in_system" : "external"
  );
  const [embryoCount, setEmbryoCount] = useState(0);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    formData.set("stallion_source", stallionSource);

    const result = await createFlushAction(donorHorseId, formData);
    if (result.error) {
      setError(result.error);
      setSaving(false);
      return;
    }

    onClose();
    router.refresh();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      onClick={onClose}
    >
      <div className="fixed inset-0 bg-black/40" />
      <div
        className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-barn-dark">Record Flush</h2>
            <p className="text-sm text-barn-dark/50">Donor: {donorName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-barn-dark/40 hover:bg-barn-dark/5 hover:text-barn-dark"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Stallion Source */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-barn-dark/70">Stallion</label>
            <div className="flex gap-2 mb-2">
              {barnStallions.length > 0 && (
                <button
                  type="button"
                  onClick={() => setStallionSource("in_system")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    stallionSource === "in_system"
                      ? "bg-brass-gold text-barn-dark"
                      : "bg-barn-dark/5 text-barn-dark/60 hover:bg-barn-dark/10"
                  }`}
                >
                  Barn Stallion
                </button>
              )}
              <button
                type="button"
                onClick={() => setStallionSource("external")}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  stallionSource === "external"
                    ? "bg-brass-gold text-barn-dark"
                    : "bg-barn-dark/5 text-barn-dark/60 hover:bg-barn-dark/10"
                }`}
              >
                External Stallion
              </button>
            </div>

            {stallionSource === "in_system" ? (
              <Select name="stallion_horse_id" label="">
                <option value="">Select stallion...</option>
                {barnStallions.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            ) : (
              <div className="space-y-2">
                <Input name="external_stallion_name" label="Stallion Name" placeholder="e.g. Metallic Cat" />
                <Input name="external_stallion_registration" label="Registration #" placeholder="AQHA #" />
              </div>
            )}
          </div>

          {/* Flush Date */}
          <Input
            name="flush_date"
            label="Flush Date"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
          />

          {/* Vet */}
          <Input name="veterinarian_name" label="Veterinarian" placeholder="Dr. Smith" />

          {/* Breeding Method */}
          <Select name="breeding_method" label="Breeding Method" defaultValue="ai_fresh">
            {BREEDING_METHOD_VALUES.map((m) => (
              <option key={m} value={m}>{BREEDING_METHOD_LABELS[m]}</option>
            ))}
          </Select>

          {/* Embryo Count */}
          <Input
            name="embryo_count"
            label="Embryos Recovered"
            type="number"
            min={0}
            max={20}
            defaultValue={0}
            onChange={(e) => setEmbryoCount(parseInt(e.target.value, 10) || 0)}
          />

          {/* Dynamic embryo grade/stage selects */}
          {embryoCount > 0 && (
            <div className="space-y-3 rounded-lg border border-barn-dark/10 bg-parchment/30 p-3">
              <p className="text-xs font-medium text-barn-dark/60">
                Grade & stage for each embryo
              </p>
              {Array.from({ length: embryoCount }, (_, i) => (
                <div key={i} className="flex gap-2 items-end">
                  <span className="pb-2.5 text-xs font-mono text-barn-dark/40 w-6">#{i + 1}</span>
                  <div className="flex-1">
                    <Select name={`grade_${i}`} label="" defaultValue="grade_1">
                      {EMBRYO_GRADES.map((g) => (
                        <option key={g} value={g}>{EMBRYO_GRADE_LABELS[g]}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="flex-1">
                    <Select name={`stage_${i}`} label="" defaultValue="morula">
                      {EMBRYO_STAGES.map((s) => (
                        <option key={s} value={s}>{EMBRYO_STAGE_LABELS[s]}</option>
                      ))}
                    </Select>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Flush Cost */}
          <Input
            name="flush_cost"
            label="Flush Cost ($)"
            type="number"
            step="0.01"
            min={0}
            placeholder="0.00"
          />

          {/* Notes */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-barn-dark/70">Notes</label>
            <textarea
              name="notes"
              rows={3}
              className="w-full rounded-xl border border-barn-dark/15 bg-white px-3 py-2.5 text-sm text-barn-dark placeholder:text-barn-dark/35 focus:border-brass-gold focus:outline-none focus:ring-2 focus:ring-brass-gold/30"
              placeholder="Optional notes..."
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} block>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={saving || embryoCount === 0} block>
              {saving ? "Recording..." : `Record Flush (${embryoCount} embryos)`}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
