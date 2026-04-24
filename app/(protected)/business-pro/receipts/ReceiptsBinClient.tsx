"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BusinessProChrome } from "@/components/business-pro/BusinessProChrome";
import { formatCurrency } from "@/lib/currency";

const breadcrumb = [
  { label: "Business Pro", href: "/business-pro" },
  { label: "Receipts" },
];

interface ReceiptGroup {
  groupKey: string;
  primaryId: string;
  barn_id: string;
  performed_at: string;
  vendor_name: string | null;
  total_cost: number;
  categories: string[];
  rowCount: number;
  receipt_file_name: string | null;
}

/**
 * Grid of receipt cards. Tap a card to open the detail page of the
 * primary row — the user can view the image there (existing
 * ReceiptBlock) and edit any of the linked rows.
 */
export function ReceiptsBinClient({
  receipts,
  barnNames,
}: {
  receipts: ReceiptGroup[];
  barnNames: Record<string, string>;
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return receipts;
    return receipts.filter((r) => {
      const parts = [
        r.vendor_name,
        r.categories.join(" "),
        barnNames[r.barn_id],
      ]
        .filter((s): s is string => !!s)
        .join(" ")
        .toLowerCase();
      return parts.includes(q);
    });
  }, [receipts, search, barnNames]);

  const totalAmount = receipts.reduce((sum, r) => sum + r.total_cost, 0);

  return (
    <BusinessProChrome breadcrumb={breadcrumb}>
      <div className="bp-page-header">
        <h1 className="bp-display" style={{ fontSize: 32 }}>
          Receipts
        </h1>
        <p
          style={{
            color: "var(--bp-ink-secondary)",
            fontSize: 13,
            marginTop: 4,
          }}
        >
          Every receipt you&apos;ve scanned, grouped by capture event.
          Tap a card to view the image and edit the linked expenses.
        </p>
      </div>

      <div style={{ padding: "0 32px 48px" }}>
        {receipts.length === 0 ? (
          <div
            className="rounded-2xl border bg-white p-8 text-center"
            style={{ borderColor: "rgba(42,64,49,0.1)" }}
          >
            <div className="text-3xl mb-2">🧾</div>
            <p className="font-serif text-lg text-barn-dark">
              No receipts yet
            </p>
            <p className="mt-2 text-sm text-barn-dark/60">
              Scan a receipt on the{" "}
              <Link href="/identify" className="underline hover:text-brass-gold">
                Scan page
              </Link>{" "}
              and it will appear here.
            </p>
          </div>
        ) : (
          <>
            <div
              className="mb-4 flex flex-wrap items-center gap-4 rounded-lg border bg-white px-3 py-2 text-sm"
              style={{ borderColor: "rgba(42,64,49,0.1)" }}
            >
              <InlineStat
                label="Receipts"
                value={receipts.length.toString()}
              />
              <InlineStat
                label="Total"
                value={formatCurrency(totalAmount)}
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search vendor, category, or barn…"
                className="ml-auto flex-1 sm:flex-none min-w-[200px] rounded-md border px-3 py-1.5 text-sm outline-none"
                style={{ borderColor: "rgba(42,64,49,0.15)" }}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((r) => (
                <Link
                  key={r.groupKey}
                  href={`/business-pro/expenses/${r.primaryId}`}
                  className="group rounded-xl border bg-white p-4 shadow-sm transition hover:border-brass-gold hover:shadow-md"
                  style={{ borderColor: "rgba(42,64,49,0.1)" }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-serif text-base font-semibold text-barn-dark truncate group-hover:text-brass-gold">
                        {r.vendor_name ?? "Receipt"}
                      </div>
                      <div className="text-xs text-barn-dark/55 mt-0.5">
                        {new Date(r.performed_at).toLocaleDateString(
                          undefined,
                          {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          },
                        )}
                        {" · "}
                        {barnNames[r.barn_id] ?? "Barn"}
                      </div>
                    </div>
                    <div className="text-right font-mono text-sm font-semibold text-barn-dark">
                      {formatCurrency(r.total_cost)}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                    {r.categories.slice(0, 4).map((c) => (
                      <span
                        key={c}
                        className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                        style={{
                          background: "rgba(139,74,43,0.1)",
                          color: "#8b4a2b",
                        }}
                      >
                        {c}
                      </span>
                    ))}
                    {r.categories.length > 4 && (
                      <span className="text-[10px] text-barn-dark/50">
                        +{r.categories.length - 4} more
                      </span>
                    )}
                    {r.rowCount > 1 && (
                      <span
                        className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{
                          background: "rgba(75,100,121,0.15)",
                          color: "#4b6479",
                        }}
                        title={`Split across ${r.rowCount} expenses`}
                      >
                        Split · {r.rowCount}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </BusinessProChrome>
  );
}

function InlineStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span
        className="text-[10px] font-semibold uppercase tracking-wide"
        style={{ color: "rgba(42,64,49,0.55)" }}
      >
        {label}
      </span>
      <span className="font-semibold text-barn-dark">{value}</span>
    </div>
  );
}
