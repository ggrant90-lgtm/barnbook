"use client";

import Link from "next/link";
import { BreedersProChrome } from "@/components/breeders-pro/BreedersProChrome";
import {
  FOALING_TYPE_LABELS,
} from "@/lib/horse-form-constants";
import type { Foaling } from "@/lib/types";

const breadcrumb = [
  { label: "Breeders Pro", href: "/breeders-pro" },
  { label: "Foaling Records" },
];

function fmtDate(iso?: string | null): string {
  if (!iso) return "\u2014";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

const TYPE_CLASS: Record<string, string> = {
  normal: "bp-status-fresh",
  assisted: "bp-status-frozen",
  dystocia: "bp-status-transferred",
  c_section: "bp-status-transferred",
  stillborn: "bp-status-lost",
};

export function FoalingRecordsClient({
  foalings,
  pregnancyMap,
  horseNames,
}: {
  foalings: Foaling[];
  pregnancyMap: Record<string, { donor_horse_id: string; stallion_horse_id: string | null }>;
  horseNames: Record<string, string>;
}) {
  return (
    <BreedersProChrome breadcrumb={breadcrumb}>
      <div className="bp-page-header">
        <h1 className="bp-display" style={{ fontSize: 32 }}>
          Foaling Records
        </h1>
        <p
          style={{
            color: "var(--bp-ink-secondary)",
            fontSize: 13,
            marginTop: 6,
          }}
        >
          All foaling events across your breeding program.
        </p>
      </div>

      <div className="px-4 md:px-8 pb-12">
        {foalings.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "48px 24px",
              color: "var(--bp-ink-tertiary)",
              fontSize: 14,
            }}
          >
            No foaling records yet. Record a foaling from a pregnancy detail
            page.
          </div>
        ) : (
          <div className="bp-table-wrap">
            <table className="bp-table bp-table-foalings">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Foal</th>
                  <th>Sex</th>
                  <th>Color</th>
                  <th>Type</th>
                  <th>Dam</th>
                  <th>Sire</th>
                  <th>Carrier</th>
                  <th>24hr</th>
                  <th>30d</th>
                </tr>
              </thead>
              <tbody>
                {foalings.map((f) => {
                  const preg = pregnancyMap[f.pregnancy_id] ?? {};
                  const damName =
                    horseNames[preg.donor_horse_id] ?? "\u2014";
                  const sireName = preg.stallion_horse_id
                    ? (horseNames[preg.stallion_horse_id] ?? "\u2014")
                    : "\u2014";
                  const carrierName =
                    horseNames[f.surrogate_horse_id] ?? "\u2014";
                  const foalName = f.foal_horse_id
                    ? (horseNames[f.foal_horse_id] ?? "Unnamed")
                    : "\u2014";

                  return (
                    <tr key={f.id}>
                      <td className="bp-mono" style={{ fontSize: 12 }}>
                        {fmtDate(f.foaling_date)}
                      </td>
                      <td style={{ fontWeight: 500 }}>
                        {f.foal_horse_id ? (
                          <Link
                            href={`/horses/${f.foal_horse_id}`}
                            style={{
                              color: "var(--bp-accent)",
                              textDecoration: "none",
                            }}
                          >
                            {foalName}
                          </Link>
                        ) : (
                          <span style={{ color: "var(--bp-ink-tertiary)" }}>
                            {foalName}
                          </span>
                        )}
                      </td>
                      <td>
                        <span
                          className="bp-mono"
                          style={{
                            fontSize: 10,
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                          }}
                        >
                          {f.foal_sex === "colt"
                            ? "Colt"
                            : f.foal_sex === "filly"
                              ? "Filly"
                              : "\u2014"}
                        </span>
                      </td>
                      <td>{f.foal_color ?? "\u2014"}</td>
                      <td>
                        <span
                          className={`bp-status ${TYPE_CLASS[f.foaling_type] ?? ""}`}
                          style={{ fontSize: 10 }}
                        >
                          {FOALING_TYPE_LABELS[f.foaling_type] ??
                            f.foaling_type}
                        </span>
                      </td>
                      <td>{damName}</td>
                      <td>{sireName}</td>
                      <td>
                        {carrierName !== damName ? (
                          <span>{carrierName}</span>
                        ) : (
                          <span
                            className="bp-mono"
                            style={{
                              fontSize: 10,
                              color: "var(--bp-ink-quaternary)",
                            }}
                          >
                            same
                          </span>
                        )}
                      </td>
                      <td>
                        {f.foal_alive_at_24hr === true ? (
                          <span style={{ color: "#16a34a" }}>Yes</span>
                        ) : f.foal_alive_at_24hr === false ? (
                          <span style={{ color: "#dc2626" }}>No</span>
                        ) : (
                          "\u2014"
                        )}
                      </td>
                      <td>
                        {f.foal_alive_at_30d === true ? (
                          <span style={{ color: "#16a34a" }}>Yes</span>
                        ) : f.foal_alive_at_30d === false ? (
                          <span style={{ color: "#dc2626" }}>No</span>
                        ) : (
                          <span
                            className="bp-mono"
                            style={{
                              fontSize: 9,
                              color: "var(--bp-ink-quaternary)",
                            }}
                          >
                            pending
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </BreedersProChrome>
  );
}
