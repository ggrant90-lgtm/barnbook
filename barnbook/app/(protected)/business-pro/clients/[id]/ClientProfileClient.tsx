"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BusinessProChrome } from "@/components/business-pro/BusinessProChrome";
import { formatCurrency } from "@/lib/currency";
import { DocumentVault } from "./DocumentVault";
import {
  archiveClientAction,
  deleteClientAction,
} from "@/app/(protected)/actions/clients";

interface ClientRow {
  id: string;
  barn_id: string;
  display_name: string;
  name_key: string;
  user_id: string | null;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  address_city: string | null;
  address_state: string | null;
  address_postal: string | null;
  address_country: string | null;
  notes: string | null;
  archived: boolean;
  created_at: string;
}

interface HorseRow {
  id: string;
  name: string;
  status: string | null;
}

interface InvoiceRow {
  id: string;
  invoice_number: string;
  issue_date: string;
  due_date: string | null;
  status: string;
  subtotal: number | null;
  paid_amount: number | null;
}

interface Entry {
  id: string;
  source: "activity" | "health";
  horse_id: string;
  activity_type?: string;
  record_type?: string;
  notes: string | null;
  performed_at: string | null;
  created_at: string;
  total_cost: number | null;
  cost_type: string | null;
  payment_status: string | null;
}

interface Doc {
  id: string;
  doc_type: string;
  custom_label: string | null;
  title: string;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  effective_date: string | null;
  expiry_date: string | null;
  created_at: string;
}

type Tab = "horses" | "invoices" | "activity" | "documents";

export function ClientProfileClient({
  client,
  barnName,
  horses,
  horseNames,
  invoices,
  activityEntries,
  healthEntries,
  documents,
  summary,
}: {
  client: ClientRow;
  barnName: string;
  horses: HorseRow[];
  horseNames: Record<string, string>;
  invoices: InvoiceRow[];
  activityEntries: Entry[];
  healthEntries: Entry[];
  documents: Doc[];
  summary: { totalBilled: number; totalPaid: number; totalOutstanding: number };
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("documents");
  const [, startTransition] = useTransition();

  const combinedEntries = [...activityEntries, ...healthEntries]
    .sort(
      (a, b) =>
        new Date(b.performed_at || b.created_at).getTime() -
        new Date(a.performed_at || a.created_at).getTime(),
    )
    .slice(0, 50);

  const address = [
    client.address_line1,
    client.address_line2,
    [client.address_city, client.address_state, client.address_postal]
      .filter(Boolean)
      .join(", "),
    client.address_country && client.address_country !== "US"
      ? client.address_country
      : null,
  ]
    .filter((s) => s && s.trim())
    .join(" · ");

  const breadcrumb = [
    { label: "Business Pro", href: "/business-pro" },
    { label: "Clients", href: "/business-pro/clients" },
    { label: client.display_name },
  ];

  const handleArchiveToggle = () => {
    startTransition(async () => {
      const res = await archiveClientAction(client.id, !client.archived);
      if (res.error) {
        alert(`Failed: ${res.error}`);
        return;
      }
      router.refresh();
    });
  };

  const handleDelete = () => {
    if (
      !confirm(
        "Delete this client? This cannot be undone. If the client has any invoices or entries, the delete will fail and you'll need to archive instead.",
      )
    )
      return;
    startTransition(async () => {
      const res = await deleteClientAction(client.id);
      if (res.error) {
        alert(res.error);
        return;
      }
      router.push("/business-pro/clients");
    });
  };

  return (
    <BusinessProChrome breadcrumb={breadcrumb}>
      <div className="bp-page-header">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <h1 className="bp-display" style={{ fontSize: 32 }}>
              {client.display_name}
              {client.archived && (
                <span
                  className="ml-3 text-xs font-mono uppercase"
                  style={{
                    background: "#e5e7eb",
                    color: "#4b5563",
                    padding: "2px 8px",
                    borderRadius: 4,
                    letterSpacing: "0.06em",
                    verticalAlign: "middle",
                  }}
                >
                  Archived
                </span>
              )}
            </h1>
            <div
              style={{
                marginTop: 6,
                fontSize: 13,
                color: "var(--bp-ink-secondary)",
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <span>{barnName}</span>
              {client.email && <span>📧 {client.email}</span>}
              {client.phone && <span>📞 {client.phone}</span>}
              {address && <span>{address}</span>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Link
              href={`/business-pro/clients/${client.id}/edit`}
              className="rounded-lg border border-barn-dark/15 bg-white px-3 py-1.5 text-sm font-medium text-barn-dark hover:bg-parchment"
            >
              Edit
            </Link>
            <button
              type="button"
              onClick={handleArchiveToggle}
              className="rounded-lg border border-barn-dark/15 bg-white px-3 py-1.5 text-sm font-medium text-barn-dark hover:bg-parchment"
            >
              {client.archived ? "Unarchive" : "Archive"}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-[#b8421f] hover:bg-[#fef2f2]"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      <div style={{ padding: "0 32px 48px", maxWidth: 1100 }}>
        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <SummaryCard label="Total billed" value={formatCurrency(summary.totalBilled)} />
          <SummaryCard label="Total paid" value={formatCurrency(summary.totalPaid)} color="#2a4031" bg="#f0fdf4" />
          <SummaryCard label="Outstanding" value={formatCurrency(summary.totalOutstanding)} color="#c9a84c" bg="#fefce8" />
          <SummaryCard label="Horses" value={String(horses.length)} />
        </div>

        {/* Tabs */}
        <div
          className="flex gap-1 mb-4"
          style={{
            borderBottom: "1px solid rgba(0,0,0,0.08)",
          }}
        >
          <TabButton label={`Documents (${documents.length})`} active={tab === "documents"} onClick={() => setTab("documents")} />
          <TabButton label={`Horses (${horses.length})`} active={tab === "horses"} onClick={() => setTab("horses")} />
          <TabButton label={`Invoices (${invoices.length})`} active={tab === "invoices"} onClick={() => setTab("invoices")} />
          <TabButton label={`Activity (${combinedEntries.length})`} active={tab === "activity"} onClick={() => setTab("activity")} />
        </div>

        {tab === "documents" && (
          <DocumentVault
            clientId={client.id}
            barnId={client.barn_id}
            documents={documents}
          />
        )}

        {tab === "horses" && (
          <>
            {horses.length === 0 ? (
              <EmptyState text="No horses linked to this client yet. Horses are matched by their owner_name field." />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {horses.map((h) => (
                  <Link
                    key={h.id}
                    href={`/horses/${h.id}`}
                    className="rounded-2xl border border-barn-dark/10 bg-white p-4 hover:border-brass-gold transition"
                  >
                    <div className="font-medium text-barn-dark">{h.name}</div>
                    {h.status && (
                      <div className="text-xs text-barn-dark/60 mt-1">
                        {h.status}
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "invoices" && (
          <>
            {invoices.length === 0 ? (
              <EmptyState text="No invoices for this client yet." />
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-barn-dark/10 bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-parchment/50 border-b border-barn-dark/10">
                    <tr>
                      <Th>Number</Th>
                      <Th>Issued</Th>
                      <Th>Due</Th>
                      <Th>Status</Th>
                      <Th align="right">Subtotal</Th>
                      <Th align="right">Outstanding</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => {
                      const outstanding = (inv.subtotal ?? 0) - (inv.paid_amount ?? 0);
                      return (
                        <tr key={inv.id} className="border-b border-barn-dark/5 hover:bg-parchment/30">
                          <td className="px-4 py-2">
                            <Link
                              href={`/business-pro/invoicing/${inv.id}`}
                              className="font-mono text-barn-dark hover:underline"
                            >
                              {inv.invoice_number}
                            </Link>
                          </td>
                          <td className="px-4 py-2 text-barn-dark/80">
                            {new Date(inv.issue_date).toLocaleDateString(undefined, { year: "2-digit", month: "short", day: "numeric" })}
                          </td>
                          <td className="px-4 py-2 text-barn-dark/80">
                            {inv.due_date ? new Date(inv.due_date).toLocaleDateString(undefined, { year: "2-digit", month: "short", day: "numeric" }) : "—"}
                          </td>
                          <td className="px-4 py-2 text-xs text-barn-dark/70 capitalize">{inv.status}</td>
                          <td className="px-4 py-2 text-right font-mono text-barn-dark">{formatCurrency(inv.subtotal ?? 0)}</td>
                          <td className="px-4 py-2 text-right font-mono text-[#c9a84c]">
                            {outstanding > 0 ? formatCurrency(outstanding) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {tab === "activity" && (
          <>
            {combinedEntries.length === 0 ? (
              <EmptyState text="No recent activity for this client." />
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-barn-dark/10 bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-parchment/50 border-b border-barn-dark/10">
                    <tr>
                      <Th>Date</Th>
                      <Th>Horse</Th>
                      <Th>Type</Th>
                      <Th>Status</Th>
                      <Th align="right">Amount</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {combinedEntries.map((e) => {
                      const t =
                        e.source === "activity"
                          ? e.activity_type
                          : e.record_type;
                      return (
                        <tr key={`${e.source}-${e.id}`} className="border-b border-barn-dark/5 hover:bg-parchment/30">
                          <td className="px-4 py-2 text-barn-dark/80">
                            {new Date(e.performed_at || e.created_at).toLocaleDateString(undefined, { year: "2-digit", month: "short", day: "numeric" })}
                          </td>
                          <td className="px-4 py-2">
                            <Link href={`/horses/${e.horse_id}`} className="text-barn-dark hover:underline">
                              {horseNames[e.horse_id] ?? "Unknown"}
                            </Link>
                          </td>
                          <td className="px-4 py-2 text-barn-dark/80">{(t ?? "other").replace(/_/g, " ")}</td>
                          <td className="px-4 py-2 text-xs text-barn-dark/70 capitalize">{e.payment_status ?? "—"}</td>
                          <td className="px-4 py-2 text-right font-mono text-barn-dark">{formatCurrency(e.total_cost ?? 0)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {client.notes && (
          <div className="mt-8">
            <h3 className="font-serif text-base font-semibold text-barn-dark mb-2">
              Notes
            </h3>
            <div className="rounded-2xl border border-barn-dark/10 bg-white p-4 whitespace-pre-wrap text-sm text-barn-dark/80">
              {client.notes}
            </div>
          </div>
        )}
      </div>
    </BusinessProChrome>
  );
}

function SummaryCard({
  label,
  value,
  color = "#2a4031",
  bg = "#f0fdf4",
}: {
  label: string;
  value: string;
  color?: string;
  bg?: string;
}) {
  return (
    <div className="rounded-2xl border border-barn-dark/10 p-4" style={{ background: bg }}>
      <div className="text-xs font-medium uppercase tracking-wide text-barn-dark/50">
        {label}
      </div>
      <div className="mt-1 font-serif text-2xl font-semibold" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function TabButton({
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
      className="px-4 py-2 text-sm font-medium transition"
      style={{
        color: active ? "var(--bp-ink)" : "var(--bp-ink-tertiary)",
        borderBottom: active ? "2px solid #c9a84c" : "2px solid transparent",
        marginBottom: -1,
      }}
    >
      {label}
    </button>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-barn-dark/10 bg-white p-8 text-center text-sm text-barn-dark/60">
      {text}
    </div>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th className={`px-4 py-2 text-xs font-medium uppercase tracking-wide text-barn-dark/60 ${align === "right" ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}
