"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BusinessProChrome } from "@/components/business-pro/BusinessProChrome";
import { formatCurrency } from "@/lib/currency";

type Status = "draft" | "sent" | "paid" | "overdue" | "void" | "partial";

interface InvoiceRow {
  id: string;
  barn_id: string;
  invoice_number: string;
  client_id: string | null;
  billable_to_user_id: string | null;
  billable_to_name: string | null;
  issue_date: string;
  due_date: string | null;
  status: Status;
  display_status: Status;
  subtotal: number;
  paid_amount: number;
  created_at: string;
}

const breadcrumb = [
  { label: "Business Pro", href: "/business-pro" },
  { label: "Invoicing" },
];

const STATUS_COLORS: Record<Status, { bg: string; color: string }> = {
  draft:   { bg: "#f3f4f6", color: "#6b7280" },
  sent:    { bg: "#dbeafe", color: "#1e40af" },
  paid:    { bg: "#dcfce7", color: "#166534" },
  overdue: { bg: "#fee2e2", color: "#991b1b" },
  partial: { bg: "#fef3c7", color: "#92400e" },
  void:    { bg: "#f3f4f6", color: "#9ca3af" },
};

const STATUS_LABELS: Record<Status, string> = {
  draft:   "Draft",
  sent:    "Sent",
  paid:    "Paid",
  overdue: "Overdue",
  partial: "Partial",
  void:    "Void",
};

export function InvoiceListClient({
  barns,
  invoices,
  profileNames,
  barnNames,
  clientNames,
}: {
  barns: { id: string; name: string }[];
  invoices: InvoiceRow[];
  profileNames: Record<string, string>;
  barnNames: Record<string, string>;
  clientNames: Record<string, string>;
}) {
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [search, setSearch] = useState("");

  const counts = useMemo(() => {
    const c: Record<Status | "all", number> = {
      all: invoices.length, draft: 0, sent: 0, paid: 0, overdue: 0, partial: 0, void: 0,
    };
    for (const inv of invoices) c[inv.display_status]++;
    return c;
  }, [invoices]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return invoices.filter((inv) => {
      if (statusFilter !== "all" && inv.display_status !== statusFilter) return false;
      if (s) {
        const clientStr = (
          (inv.client_id ? clientNames[inv.client_id] : null) ??
          (inv.billable_to_user_id ? profileNames[inv.billable_to_user_id] : null) ??
          inv.billable_to_name ??
          ""
        ).toLowerCase();
        const num = inv.invoice_number.toLowerCase();
        if (!clientStr.includes(s) && !num.includes(s)) return false;
      }
      return true;
    });
  }, [invoices, statusFilter, search, profileNames, clientNames]);

  const totalOutstanding = useMemo(
    () =>
      invoices
        .filter((i) => i.display_status === "sent" || i.display_status === "partial" || i.display_status === "overdue")
        .reduce((s, i) => s + i.subtotal - i.paid_amount, 0),
    [invoices],
  );

  const clientDisplay = (inv: InvoiceRow) =>
    (inv.client_id && clientNames[inv.client_id]) ||
    (inv.billable_to_user_id && profileNames[inv.billable_to_user_id]) ||
    inv.billable_to_name ||
    "Unassigned";

  return (
    <BusinessProChrome breadcrumb={breadcrumb}>
      <div className="bp-page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 className="bp-display" style={{ fontSize: 32 }}>Invoices</h1>
          <p style={{ color: "var(--bp-ink-secondary)", fontSize: 13, marginTop: 6 }}>
            Create, send, and track invoices across your barns.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/business-pro/invoicing/settings" className="bp-btn" style={{ fontSize: 12 }}>
            Settings
          </Link>
          <Link href="/business-pro/invoicing/new" className="bp-btn bp-primary" style={{ fontSize: 12 }}>
            + New Invoice
          </Link>
        </div>
      </div>

      <div style={{ padding: "0 32px 48px", maxWidth: 1200 }}>
        {/* Summary */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 12,
            marginBottom: 20,
          }}
        >
          <StatCard label="Total Invoices" value={String(invoices.length)} />
          <StatCard label="Outstanding" value={formatCurrency(totalOutstanding)} color="#c9a84c" />
          <StatCard label="Sent" value={String(counts.sent + counts.partial)} color="#1e40af" />
          <StatCard label="Overdue" value={String(counts.overdue)} color="#991b1b" />
        </div>

        {/* Status tabs */}
        <div style={{ display: "flex", gap: 4, background: "var(--bp-bg)", padding: 4, borderRadius: 8, marginBottom: 12, flexWrap: "wrap" }}>
          {(["all", "draft", "sent", "partial", "paid", "overdue", "void"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              style={{
                background: statusFilter === s ? "var(--bp-bg-elevated)" : "transparent",
                border: statusFilter === s ? "1px solid var(--bp-border)" : "1px solid transparent",
                borderRadius: 6,
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: statusFilter === s ? 500 : 400,
                cursor: "pointer",
                color: s === "all" ? "var(--bp-ink)" : STATUS_COLORS[s as Status].color,
              }}
            >
              {s === "all" ? `All (${counts.all})` : `${STATUS_LABELS[s as Status]} (${counts[s as Status]})`}
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by invoice # or client..."
          className="bp-input"
          style={{ fontSize: 12, maxWidth: 360, marginBottom: 16 }}
        />

        {/* List */}
        {filtered.length === 0 ? (
          <div
            style={{
              background: "var(--bp-bg-elevated)",
              border: "1px solid var(--bp-border)",
              borderRadius: 8,
              padding: "48px 24px",
              textAlign: "center",
              color: "var(--bp-ink-tertiary)",
              fontSize: 14,
            }}
          >
            {invoices.length === 0
              ? "No invoices yet. Create your first invoice from unpaid entries."
              : "No invoices match the current filters."}
          </div>
        ) : (
          <div
            style={{
              background: "var(--bp-bg-elevated)",
              border: "1px solid var(--bp-border)",
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <thead style={{ background: "var(--bp-bg)", borderBottom: "1px solid var(--bp-border)" }}>
                <tr>
                  <Th>Invoice #</Th>
                  <Th>Client</Th>
                  {barns.length > 1 && <Th>Barn</Th>}
                  <Th>Issued</Th>
                  <Th>Due</Th>
                  <Th>Status</Th>
                  <Th align="right">Amount</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => {
                  const sc = STATUS_COLORS[inv.display_status];
                  return (
                    <tr
                      key={inv.id}
                      style={{ borderBottom: "1px solid var(--bp-border)", cursor: "pointer" }}
                      onClick={() => { window.location.href = `/business-pro/invoicing/${inv.id}`; }}
                    >
                      <td style={cellStyle}>
                        <span className="bp-mono" style={{ fontWeight: 600 }}>{inv.invoice_number}</span>
                      </td>
                      <td style={cellStyle}>{clientDisplay(inv)}</td>
                      {barns.length > 1 && <td style={cellStyle}>{barnNames[inv.barn_id] ?? ""}</td>}
                      <td style={{ ...cellStyle, color: "var(--bp-ink-tertiary)" }}>
                        {new Date(inv.issue_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" })}
                      </td>
                      <td style={{ ...cellStyle, color: "var(--bp-ink-tertiary)" }}>
                        {inv.due_date ? new Date(inv.due_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" }) : "—"}
                      </td>
                      <td style={cellStyle}>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 500,
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                            padding: "2px 8px",
                            borderRadius: 4,
                            background: sc.bg,
                            color: sc.color,
                          }}
                        >
                          {STATUS_LABELS[inv.display_status]}
                        </span>
                      </td>
                      <td style={{ ...cellStyle, textAlign: "right" }}>
                        <span className="bp-mono" style={{ fontWeight: 500 }}>
                          {formatCurrency(inv.subtotal)}
                        </span>
                        {inv.display_status === "partial" && (
                          <div style={{ fontSize: 10, color: "#f59e0b" }}>
                            {formatCurrency(inv.paid_amount)} paid
                          </div>
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
    </BusinessProChrome>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div
      style={{
        background: "var(--bp-bg-elevated)",
        border: "1px solid var(--bp-border)",
        borderRadius: 8,
        padding: "14px 16px",
      }}
    >
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--bp-ink-tertiary)" }}>
        {label}
      </div>
      <div
        className="bp-mono"
        style={{ fontSize: 22, fontWeight: 600, color: color ?? "var(--bp-ink)", marginTop: 4, lineHeight: 1.1 }}
      >
        {value}
      </div>
    </div>
  );
}

const cellStyle: React.CSSProperties = { padding: "12px 14px", verticalAlign: "middle" };

function Th({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return (
    <th
      style={{
        padding: "10px 14px",
        textAlign: align ?? "left",
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        color: "var(--bp-ink-tertiary)",
        fontWeight: 500,
      }}
    >
      {children}
    </th>
  );
}
