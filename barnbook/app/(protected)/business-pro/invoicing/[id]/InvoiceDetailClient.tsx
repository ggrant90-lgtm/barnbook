"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BusinessProChrome } from "@/components/business-pro/BusinessProChrome";
import { formatCurrency } from "@/lib/currency";
import {
  updateInvoiceAction,
  addEntriesToInvoiceAction,
  removeEntriesFromInvoiceAction,
  sendInvoiceAction,
  markInvoicePaidAction,
  voidInvoiceAction,
  deleteInvoiceAction,
} from "@/app/(protected)/actions/invoices";

type Source = "activity" | "health";
type Status = "draft" | "sent" | "paid" | "overdue" | "void" | "partial";

interface Invoice {
  id: string;
  barn_id: string;
  invoice_number: string;
  billable_to_user_id: string | null;
  billable_to_name: string | null;
  issue_date: string;
  due_date: string | null;
  status: Status;
  subtotal: number;
  paid_amount: number;
  paid_at: string | null;
  notes: string | null;
  terms: string | null;
  logo_url: string | null;
  company_name: string | null;
  company_address: string | null;
  company_phone: string | null;
  company_email: string | null;
  created_at: string;
  sent_at: string | null;
}

interface Entry {
  id: string;
  source: Source;
  horse_id: string;
  performed_at: string | null;
  created_at: string;
  activity_type?: string;
  record_type?: string;
  notes: string | null;
  total_cost: number | null;
  payment_status?: string | null;
  paid_amount?: number | null;
}

const STATUS_COLORS: Record<Status, { bg: string; color: string }> = {
  draft:   { bg: "#f3f4f6", color: "#6b7280" },
  sent:    { bg: "#dbeafe", color: "#1e40af" },
  paid:    { bg: "#dcfce7", color: "#166534" },
  overdue: { bg: "#fee2e2", color: "#991b1b" },
  partial: { bg: "#fef3c7", color: "#92400e" },
  void:    { bg: "#f3f4f6", color: "#9ca3af" },
};

const STATUS_LABELS: Record<Status, string> = {
  draft: "Draft", sent: "Sent", paid: "Paid", overdue: "Overdue", partial: "Partial", void: "Void",
};

function entryDate(e: Entry): Date {
  return new Date(e.performed_at || e.created_at);
}
function entryType(e: Entry): string {
  return e.activity_type || e.record_type || "other";
}
function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function InvoiceDetailClient({
  invoice,
  barnName,
  clientName,
  entries: initialEntries,
  addableEntries: initialAddable,
  horseNames,
}: {
  invoice: Invoice;
  barnName: string;
  clientName: string;
  entries: Entry[];
  addableEntries: Entry[];
  horseNames: Record<string, string>;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [entries, setEntries] = useState(initialEntries);
  const [addable, setAddable] = useState(initialAddable);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [editingDetails, setEditingDetails] = useState(false);
  const [notes, setNotes] = useState(invoice.notes ?? "");
  const [dueDate, setDueDate] = useState(invoice.due_date ?? "");
  const [hiddenNoteIds, setHiddenNoteIds] = useState<Set<string>>(new Set());

  const breadcrumb = [
    { label: "Business Pro", href: "/business-pro" },
    { label: "Invoicing", href: "/business-pro/invoicing" },
    { label: invoice.invoice_number },
  ];

  const isLocked = invoice.status === "paid" || invoice.status === "void";
  const isDraft = invoice.status === "draft";
  const subtotal = entries.reduce((s, e) => s + (e.total_cost ?? 0), 0);

  const status: Status = (() => {
    if ((invoice.status === "sent" || invoice.status === "partial") && invoice.due_date) {
      const today = new Date().toISOString().slice(0, 10);
      if (invoice.due_date < today) return "overdue";
    }
    return invoice.status;
  })();
  const sc = STATUS_COLORS[status];

  const handleRemoveEntry = (entry: Entry) => {
    startTransition(async () => {
      const res = await removeEntriesFromInvoiceAction(invoice.id, [{ id: entry.id, source: entry.source }]);
      if (res.error) { alert(res.error); return; }
      setEntries((prev) => prev.filter((e) => !(e.id === entry.id && e.source === entry.source)));
      setAddable((prev) => [...prev, entry].sort((a, b) => entryDate(a).getTime() - entryDate(b).getTime()));
    });
  };

  const handleAddEntry = (entry: Entry) => {
    startTransition(async () => {
      const res = await addEntriesToInvoiceAction(invoice.id, [{ id: entry.id, source: entry.source }]);
      if (res.error) { alert(res.error); return; }
      setAddable((prev) => prev.filter((e) => !(e.id === entry.id && e.source === entry.source)));
      setEntries((prev) => [...prev, entry].sort((a, b) => entryDate(a).getTime() - entryDate(b).getTime()));
    });
  };

  const toggleNoteVisibility = (entry: Entry) => {
    const key = `${entry.source}:${entry.id}`;
    setHiddenNoteIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const saveDetails = () => {
    startTransition(async () => {
      const res = await updateInvoiceAction(invoice.id, {
        notes: notes.trim() || null,
        due_date: dueDate || null,
      });
      if (res.error) alert(res.error);
      else { setEditingDetails(false); router.refresh(); }
    });
  };

  const handleSend = () => {
    if (!confirm("Mark this invoice as sent? The client can be billed from this record.")) return;
    startTransition(async () => {
      const res = await sendInvoiceAction(invoice.id);
      if (res.error) alert(res.error);
      else router.refresh();
    });
  };

  const handleMarkPaid = () => {
    if (!confirm(`Mark invoice ${invoice.invoice_number} as fully paid? This will mark all ${entries.length} entries as paid.`)) return;
    startTransition(async () => {
      const res = await markInvoicePaidAction(invoice.id);
      if (res.error) alert(res.error);
      else router.refresh();
    });
  };

  const handleVoid = () => {
    if (!confirm("Void this invoice? The entries will be returned to your receivables as individual unpaid items.")) return;
    startTransition(async () => {
      const res = await voidInvoiceAction(invoice.id);
      if (res.error) alert(res.error);
      else router.refresh();
    });
  };

  const handleDelete = () => {
    if (!confirm("Delete this draft invoice? Entries will return to unpaid receivables.")) return;
    startTransition(async () => {
      const res = await deleteInvoiceAction(invoice.id);
      if (res.error) alert(res.error);
      else router.push("/business-pro/invoicing");
    });
  };

  const handlePrint = () => window.print();

  return (
    <BusinessProChrome breadcrumb={breadcrumb}>
      {/* Action bar — hidden on print */}
      <div className="bp-no-print" style={{ padding: "0 32px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="bp-mono" style={{ fontSize: 16, fontWeight: 600 }}>
            {invoice.invoice_number}
          </span>
          <span
            style={{
              fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em",
              padding: "3px 10px", borderRadius: 4, background: sc.bg, color: sc.color,
            }}
          >
            {STATUS_LABELS[status]}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={handlePrint} className="bp-btn" style={{ fontSize: 12 }}>
            Print / PDF
          </button>
          {isDraft && (
            <>
              <button onClick={handleDelete} className="bp-btn" style={{ fontSize: 12, color: "#b91c1c" }}>
                Delete Draft
              </button>
              <button onClick={handleSend} className="bp-btn bp-primary" style={{ fontSize: 12 }}>
                Mark as Sent
              </button>
            </>
          )}
          {(status === "sent" || status === "overdue" || status === "partial") && (
            <>
              <button onClick={handleVoid} className="bp-btn" style={{ fontSize: 12, color: "#b91c1c" }}>
                Void
              </button>
              <button onClick={handleMarkPaid} className="bp-btn bp-primary" style={{ fontSize: 12 }}>
                Mark as Paid
              </button>
            </>
          )}
        </div>
      </div>

      {/* Invoice body — print styling applied via bp-invoice class */}
      <div className="bp-invoice" style={{ padding: "0 32px 48px", maxWidth: 900, margin: "0 auto" }}>
        {/* ════ Header ════ */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32, gap: 24, paddingBottom: 20, borderBottom: "2px solid var(--bp-border)" }}>
          <div style={{ flex: 1 }}>
            {invoice.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={invoice.logo_url}
                alt="Logo"
                style={{ maxHeight: 60, maxWidth: 200, marginBottom: 12, objectFit: "contain" }}
              />
            )}
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--bp-ink)" }}>
              {invoice.company_name ?? barnName}
            </div>
            {invoice.company_address && (
              <div style={{ fontSize: 12, color: "var(--bp-ink-secondary)", whiteSpace: "pre-wrap", marginTop: 2 }}>
                {invoice.company_address}
              </div>
            )}
            {(invoice.company_phone || invoice.company_email) && (
              <div style={{ fontSize: 12, color: "var(--bp-ink-secondary)", marginTop: 2 }}>
                {[invoice.company_phone, invoice.company_email].filter(Boolean).join(" · ")}
              </div>
            )}
          </div>
          <div style={{ textAlign: "right", minWidth: 180 }}>
            <div className="bp-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--bp-ink)", lineHeight: 1 }}>
              INVOICE
            </div>
            <div className="bp-mono" style={{ fontSize: 14, marginTop: 6 }}>{invoice.invoice_number}</div>
            <div style={{ fontSize: 11, color: "var(--bp-ink-tertiary)", marginTop: 8 }}>
              Issued: {fmtDate(invoice.issue_date)}
            </div>
            {invoice.due_date && (
              <div style={{ fontSize: 11, color: "var(--bp-ink-tertiary)" }}>
                Due: {fmtDate(invoice.due_date)}
              </div>
            )}
          </div>
        </div>

        {/* ════ Bill To ════ */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--bp-ink-tertiary)", marginBottom: 4 }}>
            Bill To
          </div>
          <div style={{ fontSize: 15, fontWeight: 500 }}>{clientName}</div>
        </div>

        {/* ════ Entries table ════ */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--bp-ink-tertiary)" }}>
              Line Items
            </div>
            {isDraft && addable.length > 0 && (
              <button
                type="button"
                onClick={() => setShowAddPanel(!showAddPanel)}
                className="bp-btn bp-no-print"
                style={{ fontSize: 11 }}
              >
                {showAddPanel ? "Done adding" : `+ Add entry (${addable.length} available)`}
              </button>
            )}
          </div>

          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--bp-border)" }}>
                <th style={invTh}>Date</th>
                <th style={invTh}>Horse</th>
                <th style={invTh}>Description</th>
                <th style={{ ...invTh, textAlign: "right" }}>Amount</th>
                {!isLocked && <th style={{ ...invTh, width: 80 }} className="bp-no-print"></th>}
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const noteKey = `${e.source}:${e.id}`;
                const noteHidden = hiddenNoteIds.has(noteKey);
                return (
                  <tr key={noteKey} style={{ borderBottom: "1px solid var(--bp-border)" }}>
                    <td style={invTd}>{fmtDate(e.performed_at ?? e.created_at)}</td>
                    <td style={invTd}>{horseNames[e.horse_id] ?? "Unknown"}</td>
                    <td style={invTd}>
                      <span style={{ textTransform: "capitalize" }}>{entryType(e).replace(/_/g, " ")}</span>
                      {e.notes && !noteHidden && (
                        <div style={{ fontSize: 11, color: "var(--bp-ink-tertiary)", marginTop: 2 }}>
                          {e.notes}
                        </div>
                      )}
                    </td>
                    <td style={{ ...invTd, textAlign: "right" }}>
                      <span className="bp-mono">{formatCurrency(e.total_cost ?? 0)}</span>
                    </td>
                    {!isLocked && (
                      <td style={{ ...invTd, textAlign: "right" }} className="bp-no-print">
                        <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                          {e.notes && (
                            <button
                              type="button"
                              onClick={() => toggleNoteVisibility(e)}
                              title={noteHidden ? "Show notes on invoice" : "Hide notes on invoice"}
                              style={{ fontSize: 10, padding: "2px 6px", background: "transparent", border: "none", color: "var(--bp-ink-tertiary)", cursor: "pointer" }}
                            >
                              {noteHidden ? "Show" : "Hide"}
                            </button>
                          )}
                          {isDraft && (
                            <button
                              type="button"
                              onClick={() => handleRemoveEntry(e)}
                              title="Remove from invoice"
                              style={{ fontSize: 10, padding: "2px 6px", background: "transparent", border: "none", color: "#b91c1c", cursor: "pointer" }}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={isLocked ? 4 : 5} style={{ padding: "24px 8px", textAlign: "center", color: "var(--bp-ink-tertiary)", fontSize: 13 }}>
                    No entries. Add some to get started.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} style={{ ...invTd, textAlign: "right", fontWeight: 500 }}>Subtotal</td>
                <td style={{ ...invTd, textAlign: "right" }}>
                  <span className="bp-mono" style={{ fontWeight: 500 }}>{formatCurrency(subtotal)}</span>
                </td>
                {!isLocked && <td className="bp-no-print"></td>}
              </tr>
              {invoice.paid_amount > 0 && (
                <tr>
                  <td colSpan={3} style={{ ...invTd, textAlign: "right", fontWeight: 500, color: "#166534" }}>Paid</td>
                  <td style={{ ...invTd, textAlign: "right", color: "#166534" }}>
                    <span className="bp-mono">−{formatCurrency(invoice.paid_amount)}</span>
                  </td>
                  {!isLocked && <td className="bp-no-print"></td>}
                </tr>
              )}
              <tr style={{ borderTop: "2px solid var(--bp-ink)" }}>
                <td colSpan={3} style={{ ...invTd, textAlign: "right", fontWeight: 600, fontSize: 15 }}>
                  {invoice.paid_amount > 0 ? "Balance Due" : "Total"}
                </td>
                <td style={{ ...invTd, textAlign: "right" }}>
                  <span className="bp-mono" style={{ fontWeight: 700, fontSize: 18 }}>
                    {formatCurrency(subtotal - invoice.paid_amount)}
                  </span>
                </td>
                {!isLocked && <td className="bp-no-print"></td>}
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Add Panel (draft only) */}
        {isDraft && showAddPanel && addable.length > 0 && (
          <div className="bp-no-print" style={{ background: "var(--bp-bg)", border: "1px solid var(--bp-border)", borderRadius: 8, padding: 12, marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--bp-ink-tertiary)", marginBottom: 8 }}>
              Available entries for this client
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 300, overflowY: "auto" }}>
              {addable.map((e) => (
                <button
                  key={`${e.source}:${e.id}`}
                  type="button"
                  onClick={() => handleAddEntry(e)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 10px",
                    borderRadius: 6,
                    border: "1px solid var(--bp-border)",
                    background: "var(--bp-bg-elevated)",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span style={{ fontSize: 16, color: "var(--bp-accent)" }}>+</span>
                  <span className="bp-mono" style={{ fontSize: 11, color: "var(--bp-ink-tertiary)", minWidth: 60 }}>
                    {fmtDate(e.performed_at || e.created_at).slice(0, 12)}
                  </span>
                  <span style={{ fontSize: 12, minWidth: 100 }}>{horseNames[e.horse_id] ?? "Unknown"}</span>
                  <span style={{ fontSize: 11, color: "var(--bp-ink-tertiary)", minWidth: 80, textTransform: "capitalize" }}>
                    {entryType(e).replace(/_/g, " ")}
                  </span>
                  <span style={{ flex: 1, fontSize: 11, color: "var(--bp-ink-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
                    {e.notes ?? ""}
                  </span>
                  <span className="bp-mono" style={{ fontSize: 12, fontWeight: 500 }}>
                    {formatCurrency(e.total_cost ?? 0)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ════ Notes ════ */}
        {(invoice.notes || invoice.terms || editingDetails) && (
          <div style={{ marginBottom: 20 }}>
            {editingDetails ? (
              <div className="bp-no-print" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div>
                  <label className="bp-label">Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="bp-input"
                    style={{ maxWidth: 200 }}
                  />
                </div>
                <div>
                  <label className="bp-label">Notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="bp-input"
                    style={{ resize: "vertical" }}
                  />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" onClick={saveDetails} className="bp-btn bp-primary" style={{ fontSize: 12 }}>
                    Save
                  </button>
                  <button type="button" onClick={() => setEditingDetails(false)} className="bp-btn" style={{ fontSize: 12 }}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                {invoice.notes && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--bp-ink-tertiary)", marginBottom: 4 }}>
                      Notes
                    </div>
                    <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{invoice.notes}</div>
                  </div>
                )}
                {invoice.terms && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--bp-ink-tertiary)", marginBottom: 4 }}>
                      Terms
                    </div>
                    <div style={{ fontSize: 12, color: "var(--bp-ink-secondary)", whiteSpace: "pre-wrap" }}>{invoice.terms}</div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {!editingDetails && !isLocked && (
          <button
            type="button"
            onClick={() => setEditingDetails(true)}
            className="bp-btn bp-no-print"
            style={{ fontSize: 11 }}
          >
            {invoice.notes || invoice.due_date ? "Edit Notes / Due Date" : "Add Notes / Due Date"}
          </button>
        )}
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          .bp-no-print, .bp-sidebar, .bp-topbar, .bp-sidebar-backdrop { display: none !important; }
          .bp-main { padding: 0 !important; margin: 0 !important; }
          .bp-chrome { display: block !important; }
          .bp-invoice { max-width: 100% !important; padding: 24px !important; }
          body { background: white !important; }
        }
      `}</style>
    </BusinessProChrome>
  );
}

const invTh: React.CSSProperties = {
  padding: "10px 8px",
  textAlign: "left",
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "var(--bp-ink-tertiary)",
  fontWeight: 500,
};
const invTd: React.CSSProperties = {
  padding: "12px 8px",
  fontSize: 13,
  verticalAlign: "top",
};
