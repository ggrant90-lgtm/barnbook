"use client";

import Link from "next/link";
import type { Flush } from "@/lib/types";

export function DonorBreedingSection({
  horse,
  flushes,
}: {
  horse: { id: string; lifetime_embryo_count?: number; lifetime_live_foal_count?: number };
  flushes: Flush[];
}) {
  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-barn-dark/10 bg-parchment/30 p-3 text-center">
          <p className="text-2xl font-semibold text-barn-dark">{flushes.length}</p>
          <p className="text-xs text-barn-dark/50">Flushes</p>
        </div>
        <div className="rounded-xl border border-barn-dark/10 bg-parchment/30 p-3 text-center">
          <p className="text-2xl font-semibold text-barn-dark">{horse.lifetime_embryo_count ?? 0}</p>
          <p className="text-xs text-barn-dark/50">Embryos</p>
        </div>
        <div className="rounded-xl border border-barn-dark/10 bg-parchment/30 p-3 text-center">
          <p className="text-2xl font-semibold text-barn-dark">{horse.lifetime_live_foal_count ?? 0}</p>
          <p className="text-xs text-barn-dark/50">Live Foals</p>
        </div>
      </div>

      {/* Flush history */}
      {flushes.length > 0 ? (
        <div>
          <h3 className="text-xs font-semibold text-barn-dark/60 uppercase tracking-wide">Flush History</h3>
          <div className="mt-2 space-y-2">
            {flushes.slice(0, 5).map((flush) => (
              <div
                key={flush.id}
                className="flex items-center justify-between rounded-lg border border-barn-dark/5 px-3 py-2.5"
              >
                <div>
                  <p className="text-sm text-barn-dark">
                    {new Date(flush.flush_date).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-barn-dark/50">
                    {flush.embryo_count} embryo{flush.embryo_count !== 1 ? "s" : ""}
                    {flush.breeding_method && ` \u00B7 ${flush.breeding_method.replace(/_/g, " ").toUpperCase()}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-barn-dark/50">No flushes recorded yet.</p>
      )}

      <Link
        href="/embryo-bank"
        className="inline-flex items-center gap-1 text-sm text-brass-gold hover:underline"
      >
        View Embryo Bank
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
        </svg>
      </Link>
    </div>
  );
}
