"use client";

import { useEffect, useMemo, useState } from "react";
import type { ExtractedHorseData } from "@/lib/document-extraction-prompt";
import type { MatchedHorse } from "@/lib/document-scanner/horse-matcher";

export type FieldDecision = {
  choice: "keep" | "update" | "skip";
  newValue?: string;
};

/**
 * The mapping from the extraction payload to horse table columns.
 * Kept narrow: only fields we're willing to patch on the horses row.
 */
const FIELD_MAP: Array<{
  key: string; // horses column name
  label: string;
  from: (e: ExtractedHorseData) => string | null;
}> = [
  { key: "breed", label: "Breed", from: (e) => e.breed },
  { key: "sex", label: "Sex", from: (e) => e.sex },
  { key: "color", label: "Color", from: (e) => e.color },
  { key: "foal_date", label: "Foal date", from: (e) => e.foal_date },
  {
    key: "registration_number",
    label: "Registration #",
    from: (e) => e.registration_number,
  },
  { key: "sire", label: "Sire", from: (e) => e.sire },
  { key: "dam", label: "Dam", from: (e) => e.dam },
  {
    key: "microchip_number",
    label: "Microchip",
    from: (e) => e.microchip_number,
  },
  { key: "owner_name", label: "Owner", from: (e) => e.owner_name },
];

/**
 * Field-by-field conflict resolver.
 *
 * Three outcomes per field:
 *   - Extraction has a value, existing is empty   → default "update" (fill in)
 *   - Extraction matches existing                 → hide (nothing to do)
 *   - Extraction differs from existing            → default "keep"; user picks
 *   - Extraction is null                          → hide
 */
export function ConflictResolver({
  extracted,
  existing,
  onChange,
}: {
  extracted: ExtractedHorseData;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  existing: MatchedHorse & Record<string, any>;
  onChange: (decisions: Record<string, FieldDecision>) => void;
}) {
  const rows = useMemo(() => {
    return FIELD_MAP.map((f) => {
      const newVal = (f.from(extracted) ?? "").toString().trim();
      const currentVal = ((existing as Record<string, unknown>)[f.key] ?? "")
        .toString()
        .trim();
      return { ...f, newVal, currentVal };
    }).filter(
      (r) =>
        r.newVal &&
        r.newVal.toLowerCase() !== r.currentVal.toLowerCase(),
    );
  }, [extracted, existing]);

  const [decisions, setDecisions] = useState<Record<string, FieldDecision>>(
    () => {
      const d: Record<string, FieldDecision> = {};
      for (const r of rows) {
        d[r.key] = r.currentVal
          ? { choice: "keep" }
          : { choice: "update", newValue: r.newVal };
      }
      return d;
    },
  );

  useEffect(() => {
    onChange(decisions);
  }, [decisions, onChange]);

  if (rows.length === 0) return null;

  return (
    <div className="mt-3">
      <div className="text-xs uppercase tracking-wide text-barn-dark/60 mb-1">
        Fields to update
      </div>
      <div className="rounded-lg border border-barn-dark/10 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-parchment/50 border-b border-barn-dark/10">
            <tr>
              <th className="px-3 py-1.5 text-left text-xs font-medium uppercase tracking-wide text-barn-dark/55">
                Field
              </th>
              <th className="px-3 py-1.5 text-left text-xs font-medium uppercase tracking-wide text-barn-dark/55">
                Current
              </th>
              <th className="px-3 py-1.5 text-left text-xs font-medium uppercase tracking-wide text-barn-dark/55">
                From document
              </th>
              <th className="px-3 py-1.5 text-right text-xs font-medium uppercase tracking-wide text-barn-dark/55">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const d = decisions[r.key] ?? { choice: "keep" as const };
              return (
                <tr
                  key={r.key}
                  className="border-b border-barn-dark/5 last:border-0"
                >
                  <td className="px-3 py-1.5 text-barn-dark">{r.label}</td>
                  <td className="px-3 py-1.5 text-barn-dark/70">
                    {r.currentVal || (
                      <span className="text-barn-dark/40 text-xs">empty</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-barn-dark">{r.newVal}</td>
                  <td className="px-3 py-1.5">
                    <div className="flex gap-1 justify-end">
                      <ActionChip
                        label="Keep"
                        active={d.choice === "keep"}
                        onClick={() =>
                          setDecisions((prev) => ({
                            ...prev,
                            [r.key]: { choice: "keep" },
                          }))
                        }
                      />
                      <ActionChip
                        label="Update"
                        active={d.choice === "update"}
                        onClick={() =>
                          setDecisions((prev) => ({
                            ...prev,
                            [r.key]: {
                              choice: "update",
                              newValue: r.newVal,
                            },
                          }))
                        }
                      />
                      <ActionChip
                        label="Skip"
                        active={d.choice === "skip"}
                        onClick={() =>
                          setDecisions((prev) => ({
                            ...prev,
                            [r.key]: { choice: "skip" },
                          }))
                        }
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ActionChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md px-2 py-0.5 text-xs font-medium transition"
      style={{
        background: active ? "#c9a84c" : "white",
        color: active ? "#2a4031" : "#6b7280",
        border: active ? "1px solid #c9a84c" : "1px solid rgba(0,0,0,0.12)",
      }}
    >
      {label}
    </button>
  );
}
