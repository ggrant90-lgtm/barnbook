"use client";

import { useState } from "react";
import Link from "next/link";
import type { Embryo } from "@/lib/types";
import {
  EMBRYO_STATUS_LABELS,
  EMBRYO_GRADE_LABELS,
  EMBRYO_STAGE_LABELS,
  type EmbryoStatus,
} from "@/lib/horse-form-constants";

const STATUS_TABS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "in_bank_fresh", label: "Fresh" },
  { value: "in_bank_frozen", label: "Frozen" },
  { value: "transferred", label: "Transferred" },
  { value: "became_foal", label: "Foaled" },
  { value: "shipped_out", label: "Shipped" },
  { value: "lost", label: "Lost" },
];

function statusColor(status: EmbryoStatus): string {
  switch (status) {
    case "in_bank_fresh":
      return "bg-green-100 text-green-800";
    case "in_bank_frozen":
      return "bg-blue-100 text-blue-800";
    case "transferred":
      return "bg-amber-100 text-amber-800";
    case "became_foal":
      return "bg-brass-gold/20 text-barn-dark";
    case "shipped_out":
      return "bg-purple-100 text-purple-800";
    case "lost":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export function EmbryoBankClient({
  embryos,
  horseNames,
  canEdit,
}: {
  embryos: Embryo[];
  horseNames: Record<string, string>;
  canEdit: boolean;
}) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = embryos.filter((e) => {
    if (statusFilter !== "all" && e.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const donorName = horseNames[e.donor_horse_id] ?? "";
      const stallionName = e.stallion_horse_id ? (horseNames[e.stallion_horse_id] ?? "") : (e.external_stallion_name ?? "");
      if (
        !e.embryo_code.toLowerCase().includes(q) &&
        !donorName.toLowerCase().includes(q) &&
        !stallionName.toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  const statusCounts: Record<string, number> = {};
  for (const e of embryos) {
    statusCounts[e.status] = (statusCounts[e.status] ?? 0) + 1;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-barn-dark">Embryo Bank</h1>
          <p className="text-sm text-barn-dark/50">{embryos.length} embryo{embryos.length !== 1 ? "s" : ""} total</p>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {STATUS_TABS.map((tab) => {
          const count = tab.value === "all" ? embryos.length : (statusCounts[tab.value] ?? 0);
          if (tab.value !== "all" && count === 0) return null;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setStatusFilter(tab.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                statusFilter === tab.value
                  ? "bg-brass-gold text-barn-dark"
                  : "bg-barn-dark/5 text-barn-dark/60 hover:bg-barn-dark/10"
              }`}
            >
              {tab.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="mt-3">
        <input
          type="text"
          placeholder="Search by code, donor, or stallion..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-barn-dark/15 bg-white px-3 py-2.5 text-sm text-barn-dark placeholder:text-barn-dark/35 focus:border-brass-gold focus:outline-none focus:ring-2 focus:ring-brass-gold/30"
        />
      </div>

      {/* Embryo cards */}
      {filtered.length === 0 ? (
        <div className="mt-10 text-center">
          <p className="text-sm text-barn-dark/50">
            {embryos.length === 0
              ? "No embryos yet. Record a flush from a donor mare to get started."
              : "No embryos match your filters."}
          </p>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {filtered.map((embryo) => {
            const donorName = horseNames[embryo.donor_horse_id] ?? "Unknown";
            const stallionName = embryo.stallion_horse_id
              ? (horseNames[embryo.stallion_horse_id] ?? "Unknown")
              : (embryo.external_stallion_name ?? "External");

            return (
              <Link
                key={embryo.id}
                href={`/embryo-bank/${embryo.id}`}
                className="rounded-xl border border-barn-dark/10 bg-white p-4 shadow-sm transition hover:border-brass-gold/40 hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-mono text-sm font-semibold text-barn-dark">{embryo.embryo_code}</p>
                    <p className="mt-0.5 text-xs text-barn-dark/50">
                      {donorName} x {stallionName}
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(embryo.status)}`}>
                    {EMBRYO_STATUS_LABELS[embryo.status]}
                  </span>
                </div>
                <div className="mt-3 flex gap-4 text-xs text-barn-dark/60">
                  <span>{EMBRYO_GRADE_LABELS[embryo.grade]}</span>
                  <span>{EMBRYO_STAGE_LABELS[embryo.stage]}</span>
                </div>
                <p className="mt-1 text-xs text-barn-dark/40">
                  {new Date(embryo.created_at).toLocaleDateString()}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
