"use client";

import Link from "next/link";
import type { Pregnancy } from "@/lib/types";
import { PREGNANCY_STATUS_LABELS } from "@/lib/horse-form-constants";

function urgencyColor(daysToFoal: number | null, status: string): string {
  if (status !== "pending_check" && status !== "confirmed") return "border-barn-dark/10";
  if (daysToFoal == null) return "border-barn-dark/10";
  if (daysToFoal <= 14) return "border-red-300 bg-red-50/30";
  if (daysToFoal <= 30) return "border-amber-300 bg-amber-50/30";
  if (daysToFoal <= 60) return "border-yellow-200 bg-yellow-50/20";
  return "border-barn-dark/10";
}

function statusBadge(status: string): string {
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

export function PregnancyListClient({
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
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-barn-dark">Pregnancies</h1>
          <p className="text-sm text-barn-dark/50">{active.length} active</p>
        </div>
        <Link
          href="/embryo-bank"
          className="text-sm text-barn-dark/50 hover:text-barn-dark transition"
        >
          Embryo Bank
        </Link>
      </div>

      {active.length === 0 && past.length === 0 ? (
        <div className="mt-10 text-center text-sm text-barn-dark/50">
          No pregnancies yet. Transfer an embryo to a surrogate to get started.
        </div>
      ) : null}

      {active.length > 0 && (
        <div className="mt-4 space-y-2">
          <h2 className="text-xs font-semibold text-barn-dark/60 uppercase tracking-wide">Active</h2>
          {active.map((p) => {
            const daysToFoal = p.expected_foaling_date
              ? Math.floor((new Date(p.expected_foaling_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              : null;
            const surrogateName = horseNames[p.surrogate_horse_id] ?? "Unknown";
            const donorName = p.donor_horse_id ? (horseNames[p.donor_horse_id] ?? "Unknown") : "Unknown";

            return (
              <Link
                key={p.id}
                href={`/embryo-bank/pregnancy/${p.id}`}
                className={`block rounded-xl border p-4 shadow-sm transition hover:shadow-md ${urgencyColor(daysToFoal, p.status)}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-barn-dark">{surrogateName}</p>
                    <p className="text-xs text-barn-dark/50">Donor: {donorName}</p>
                  </div>
                  <div className="text-right">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(p.status)}`}>
                      {PREGNANCY_STATUS_LABELS[p.status]}
                    </span>
                    {daysToFoal != null && (
                      <p className="mt-1 text-xs text-barn-dark/50">
                        {daysToFoal > 0 ? `${daysToFoal}d to foal` : "Due!"}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {past.length > 0 && (
        <div className="mt-6 space-y-2">
          <h2 className="text-xs font-semibold text-barn-dark/60 uppercase tracking-wide">Past</h2>
          {past.map((p) => {
            const surrogateName = horseNames[p.surrogate_horse_id] ?? "Unknown";
            return (
              <Link
                key={p.id}
                href={`/embryo-bank/pregnancy/${p.id}`}
                className="block rounded-xl border border-barn-dark/10 p-4 shadow-sm transition hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <p className="text-sm font-medium text-barn-dark">{surrogateName}</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(p.status)}`}>
                    {PREGNANCY_STATUS_LABELS[p.status]}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
