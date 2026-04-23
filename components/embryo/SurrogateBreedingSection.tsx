"use client";

import Link from "next/link";
import type { Pregnancy } from "@/lib/types";
import { PREGNANCY_STATUS_LABELS, PREGNANCY_CHECK_LABELS, PREGNANCY_CHECKS } from "@/lib/horse-form-constants";

export function SurrogateBreedingSection({
  pregnancies,
  horseNames,
}: {
  pregnancies: Pregnancy[];
  horseNames: Record<string, string>;
}) {
  const active = pregnancies.filter(
    (p) => p.status === "pending_check" || p.status === "confirmed"
  );
  const past = pregnancies.filter(
    (p) => p.status !== "pending_check" && p.status !== "confirmed"
  );

  return (
    <div className="space-y-4">
      {/* Active pregnancy */}
      {active.length > 0 ? (
        <div>
          <h3 className="text-xs font-semibold text-barn-dark/60 uppercase tracking-wide">Current Pregnancy</h3>
          {active.map((p) => {
            const donorName = p.donor_horse_id ? (horseNames[p.donor_horse_id] ?? "Unknown") : "Unknown";
            const daysToFoal = p.expected_foaling_date
              ? Math.floor((new Date(p.expected_foaling_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              : null;

            return (
              <Link
                key={p.id}
                href={`/embryo-bank/pregnancy/${p.id}`}
                className="mt-2 block rounded-xl border border-brass-gold/30 bg-brass-gold/5 p-4 transition hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-barn-dark">Donor: {donorName}</p>
                    <p className="text-xs text-barn-dark/50">
                      Transferred {new Date(p.transfer_date).toLocaleDateString()}
                    </p>
                  </div>
                  {daysToFoal != null && (
                    <div className="text-right">
                      <p className="text-lg font-semibold text-barn-dark">{daysToFoal > 0 ? daysToFoal : 0}</p>
                      <p className="text-xs text-barn-dark/50">days to foal</p>
                    </div>
                  )}
                </div>

                {/* Check timeline */}
                <div className="mt-3 flex gap-1">
                  {PREGNANCY_CHECKS.map((check) => {
                    const value = p[check] ?? "not_done";
                    let bg = "bg-barn-dark/10";
                    if (value === "confirmed") bg = "bg-green-400";
                    else if (value === "not_pregnant") bg = "bg-red-400";
                    else if (value === "pending") bg = "bg-amber-300";
                    return (
                      <div key={check} className="flex-1" title={PREGNANCY_CHECK_LABELS[check]}>
                        <div className={`h-1.5 rounded-full ${bg}`} />
                        <p className="mt-0.5 text-center text-[10px] text-barn-dark/40">
                          {check.replace("check_", "").replace("_day", "d")}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-barn-dark/50">No active pregnancy.</p>
      )}

      {/* Past pregnancies */}
      {past.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-barn-dark/60 uppercase tracking-wide">History</h3>
          <div className="mt-2 space-y-2">
            {past.map((p) => (
              <Link
                key={p.id}
                href={`/embryo-bank/pregnancy/${p.id}`}
                className="flex items-center justify-between rounded-lg border border-barn-dark/5 px-3 py-2.5 hover:border-brass-gold/30 transition"
              >
                <div>
                  <p className="text-sm text-barn-dark">
                    {new Date(p.transfer_date).toLocaleDateString()}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  p.status === "foaled" ? "bg-brass-gold/20 text-barn-dark" : "bg-red-100 text-red-800"
                }`}>
                  {PREGNANCY_STATUS_LABELS[p.status]}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <Link
        href="/embryo-bank/pregnancies"
        className="inline-flex items-center gap-1 text-sm text-brass-gold hover:underline"
      >
        View All Pregnancies
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
        </svg>
      </Link>
    </div>
  );
}
