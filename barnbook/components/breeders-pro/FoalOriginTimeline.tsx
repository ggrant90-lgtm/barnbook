"use client";

import Link from "next/link";
import type { Flush, Embryo, Pregnancy, Foaling } from "@/lib/types";
import { EMBRYO_GRADE_LABELS, EMBRYO_STAGE_LABELS, FOALING_TYPE_LABELS } from "@/lib/horse-form-constants";

export interface FoalOriginData {
  foaling: Foaling;
  pregnancy: Pregnancy;
  embryo: Embryo | null;
  flush: Flush | null;
  horseNames: Record<string, string>;
}

function TimelineDot({ active }: { active?: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <div className={`h-3 w-3 rounded-full border-2 ${active ? "border-brass-gold bg-brass-gold" : "border-barn-dark/30 bg-parchment"}`} />
    </div>
  );
}

function TimelineConnector() {
  return <div className="ml-[5px] w-0.5 bg-barn-dark/15 min-h-[16px]" />;
}

export function FoalOriginTimeline({ data }: { data: FoalOriginData }) {
  const { foaling, pregnancy, embryo, flush, horseNames } = data;

  const donorName = pregnancy.donor_horse_id ? (horseNames[pregnancy.donor_horse_id] ?? "Unknown") : "Unknown";
  const stallionName = pregnancy.stallion_horse_id ? (horseNames[pregnancy.stallion_horse_id] ?? "Unknown") : (embryo?.external_stallion_name ?? "Unknown");
  const surrogateName = foaling.surrogate_horse_id ? (horseNames[foaling.surrogate_horse_id] ?? "Unknown") : "Unknown";

  return (
    <div className="space-y-1">
      <h3 className="text-xs font-semibold text-barn-dark/60 uppercase tracking-wide mb-3">Origin Timeline</h3>

      {/* Parentage cards */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-xl border border-barn-dark/10 bg-parchment/30 p-3">
          <p className="text-xs text-barn-dark/50 uppercase tracking-wide">Dam (Donor)</p>
          {pregnancy.donor_horse_id ? (
            <Link href={`/horses/${pregnancy.donor_horse_id}`} className="text-sm font-semibold text-brass-gold hover:underline">
              {donorName}
            </Link>
          ) : (
            <p className="text-sm font-semibold text-barn-dark">{donorName}</p>
          )}
        </div>
        <div className="rounded-xl border border-barn-dark/10 bg-parchment/30 p-3">
          <p className="text-xs text-barn-dark/50 uppercase tracking-wide">Sire</p>
          {pregnancy.stallion_horse_id ? (
            <Link href={`/horses/${pregnancy.stallion_horse_id}`} className="text-sm font-semibold text-brass-gold hover:underline">
              {stallionName}
            </Link>
          ) : (
            <p className="text-sm font-semibold text-barn-dark">{stallionName}</p>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="rounded-xl border border-barn-dark/10 bg-white/50 p-4">
        {/* Step 1: Flush */}
        {flush && (
          <>
            <div className="flex gap-3">
              <TimelineDot />
              <div className="flex-1 pb-1">
                <p className="text-xs font-semibold text-barn-dark/60 uppercase">Flush</p>
                <p className="text-sm text-barn-dark">
                  {new Date(flush.flush_date).toLocaleDateString()}
                </p>
                <p className="text-xs text-barn-dark/50">
                  {flush.embryo_count} embryo{flush.embryo_count !== 1 ? "s" : ""} collected
                  {flush.breeding_method && ` \u00B7 ${flush.breeding_method.replace(/_/g, " ")}`}
                </p>
                {flush.veterinarian_name && (
                  <p className="text-xs text-barn-dark/50">Vet: {flush.veterinarian_name}</p>
                )}
              </div>
            </div>
            <TimelineConnector />
          </>
        )}

        {/* Step 2: Embryo */}
        {embryo && (
          <>
            <div className="flex gap-3">
              <TimelineDot />
              <div className="flex-1 pb-1">
                <p className="text-xs font-semibold text-barn-dark/60 uppercase">Embryo</p>
                <p className="text-sm text-barn-dark">
                  {embryo.label || embryo.embryo_code}
                </p>
                <p className="text-xs text-barn-dark/50">
                  {EMBRYO_GRADE_LABELS[embryo.grade]} \u00B7 {EMBRYO_STAGE_LABELS[embryo.stage]}
                </p>
                {embryo.freeze_date && (
                  <p className="text-xs text-barn-dark/50">
                    Frozen: {new Date(embryo.freeze_date).toLocaleDateString()}
                    {embryo.freeze_method && ` (${embryo.freeze_method.replace(/_/g, " ")})`}
                  </p>
                )}
              </div>
            </div>
            <TimelineConnector />
          </>
        )}

        {/* Step 3: Transfer / Pregnancy */}
        <div className="flex gap-3">
          <TimelineDot />
          <div className="flex-1 pb-1">
            <p className="text-xs font-semibold text-barn-dark/60 uppercase">Transfer</p>
            <p className="text-sm text-barn-dark">
              {new Date(pregnancy.transfer_date).toLocaleDateString()}
            </p>
            <p className="text-xs text-barn-dark/50">
              Surrogate: {foaling.surrogate_horse_id ? (
                <Link href={`/horses/${foaling.surrogate_horse_id}`} className="text-brass-gold hover:underline">
                  {surrogateName}
                </Link>
              ) : surrogateName}
            </p>
            {pregnancy.transfer_veterinarian_name && (
              <p className="text-xs text-barn-dark/50">Vet: {pregnancy.transfer_veterinarian_name}</p>
            )}
          </div>
        </div>
        <TimelineConnector />

        {/* Step 4: Pregnancy checks */}
        {pregnancy.status === "foaled" && (
          <>
            <div className="flex gap-3">
              <TimelineDot />
              <div className="flex-1 pb-1">
                <p className="text-xs font-semibold text-barn-dark/60 uppercase">Pregnancy Confirmed</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {(["14", "30", "45", "60", "90"] as const).map((day) => {
                    const val = pregnancy[`check_${day}_day` as keyof typeof pregnancy] as string | null;
                    if (!val || val === "not_checked") return null;
                    return (
                      <span
                        key={day}
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          val === "positive" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                        }`}
                      >
                        {day}d: {val}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
            <TimelineConnector />
          </>
        )}

        {/* Step 5: Foaling */}
        <div className="flex gap-3">
          <TimelineDot active />
          <div className="flex-1">
            <p className="text-xs font-semibold text-brass-gold uppercase">Born</p>
            <p className="text-sm font-medium text-barn-dark">
              {new Date(foaling.foaling_date).toLocaleDateString()}
              {foaling.foaling_time && ` at ${foaling.foaling_time}`}
            </p>
            <p className="text-xs text-barn-dark/50">
              {FOALING_TYPE_LABELS[foaling.foaling_type]}
              {foaling.birth_weight_lbs && ` \u00B7 ${foaling.birth_weight_lbs} lbs`}
            </p>
            {foaling.attending_vet_name && (
              <p className="text-xs text-barn-dark/50">Vet: {foaling.attending_vet_name}</p>
            )}
            {foaling.complications && (
              <p className="text-xs text-red-600 mt-1">Complications: {foaling.complications}</p>
            )}
            {foaling.notes && (
              <p className="text-xs text-barn-dark/50 mt-1 italic">{foaling.notes}</p>
            )}
          </div>
        </div>

        {/* Survival milestones */}
        {(foaling.foal_alive_at_24hr != null || foaling.foal_alive_at_30d != null) && (
          <div className="mt-3 pt-3 border-t border-barn-dark/10">
            <p className="text-xs font-semibold text-barn-dark/60 uppercase tracking-wide mb-2">Survival Milestones</p>
            <div className="flex gap-4">
              {foaling.foal_alive_at_24hr != null && (
                <div className="flex items-center gap-1.5">
                  <span className={`inline-block h-2 w-2 rounded-full ${foaling.foal_alive_at_24hr ? "bg-green-500" : "bg-red-500"}`} />
                  <span className="text-xs text-barn-dark/70">24-hour check</span>
                </div>
              )}
              {foaling.foal_alive_at_30d != null && (
                <div className="flex items-center gap-1.5">
                  <span className={`inline-block h-2 w-2 rounded-full ${foaling.foal_alive_at_30d ? "bg-green-500" : "bg-red-500"}`} />
                  <span className="text-xs text-barn-dark/70">30-day check</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
