"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BusinessProChrome } from "@/components/business-pro/BusinessProChrome";
import { formatCurrency } from "@/lib/currency";
import { createInvoiceAction } from "@/app/(protected)/actions/invoices";

interface Entry {
  id: string;
  source: "activity" | "health";
  horse_id: string;
  barn_id: string | null;
  performed_at: string | null;
  created_at: string;
  activity_type?: string;
  record_type?: string;
  notes: string | null;
  total_cost: number | null;
  billable_to_user_id: string | null;
  billable_to_name: string | null;
}

const breadcrumb = [
  { label: "Business Pro", href: "/business-pro" },
  { label: "Invoicing", href: "/business-pro/invoicing" },
  { label: "New Invoice" },
];

function entryDate(e: Entry): Date {
  return new Date(e.performed_at || e.created_at);
}

function entryType(e: Entry): string {
  return e.activity_type || e.record_type || "other";
}

function clientKey(e: Entry): string {
  if (e.billable_to_user_id) return `u:${e.billable_to_user_id}`;
  if (e.billable_to_name) return `n:${e.billable_to_name.trim().toLowerCase()}`;
  return "unassigned";
}

export function NewInvoiceClient({
  barns,
  entries,
  horseNames,
  barnNames,
  profileNames,
  ownersByBarn,
}: {
  barns: { id: string; name: string }[];
  entries: Entry[];
  horseNames: Record<string, string>;
  barnNames: Record<string, string>;
  profileNames: Record<string, string>;
  ownersByBarn: Record<string, { name: string; horseCount: number; horseIds: string[] }[]>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Step 1: Pick barn
  const [barnId, setBarnId] = useState(barns[0]?.id ?? "");

  // Step 2: Pick client — can be:
  //   - an existing barn member referenced by billable_to_user_id
  //   - a free-text name already used in billable_to_name
  //   - a horse owner (from horses.owner_name) — auto-bundles all unpaid
  //     entries for horses they own
  //   - a manually typed name
  type ClientChoice =
    | { kind: "user"; id: string; display: string }
    | { kind: "name"; name: string }
    | { kind: "owner"; name: string; horseIds: string[] };
  const [client, setClient] = useState<ClientChoice | null>(null);
  const [manualName, setManualName] = useState("");

  // Pre-computed clients from existing entries (in selected barn only)
  const availableClients = useMemo(() => {
    const seen = new Map<string, ClientChoice>();
    for (const e of entries) {
      if (e.barn_id !== barnId) continue;
      if (e.billable_to_user_id) {
        const key = `u:${e.billable_to_user_id}`;
        if (!seen.has(key)) {
          seen.set(key, {
            kind: "user",
            id: e.billable_to_user_id,
            display: profileNames[e.billable_to_user_id] ?? e.billable_to_name ?? "Member",
          });
        }
      } else if (e.billable_to_name) {
        const key = `n:${e.billable_to_name.trim().toLowerCase()}`;
        if (!seen.has(key)) {
          seen.set(key, { kind: "name", name: e.billable_to_name });
        }
      }
    }
    return Array.from(seen.values()).sort((a, b) => {
      const aName = a.kind === "user" ? a.display : a.name;
      const bName = b.kind === "user" ? b.display : b.name;
      return aName.localeCompare(bName);
    });
  }, [entries, barnId, profileNames]);

  // Step 3: Pick entries — filtered by client + barn
  const [includedIds, setIncludedIds] = useState<Set<string>>(new Set());

  // When an owner is picked, track which of their horses are "active"
  // (the user can uncheck individual horses to exclude all their entries)
  const [activeHorseIds, setActiveHorseIds] = useState<Set<string>>(new Set());

  const matchingEntries = useMemo(() => {
    if (!client) return [];
    return entries.filter((e) => {
      if (e.barn_id !== barnId) return false;
      if (client.kind === "user") return e.billable_to_user_id === client.id;
      if (client.kind === "owner") {
        // Owner: entries for horses the owner owns, filtered to active horse set
        if (!client.horseIds.includes(e.horse_id)) return false;
        return activeHorseIds.has(e.horse_id);
      }
      return (e.billable_to_name ?? "").trim().toLowerCase() === client.name.trim().toLowerCase();
    }).sort((a, b) => entryDate(a).getTime() - entryDate(b).getTime());
  }, [entries, barnId, client, activeHorseIds]);

  // Also show unassigned entries so user can bundle them in if they're really
  // for this client (common case: log entry was missing billable_to but the
  // service was actually for this client). For owner-picked clients, hide
  // this section since we already pulled by horse ownership.
  const unassignedEntries = useMemo(() => {
    if (!client) return [];
    if (client.kind === "owner") return [];
    return entries.filter((e) => {
      if (e.barn_id !== barnId) return false;
      return !e.billable_to_user_id && !e.billable_to_name;
    }).sort((a, b) => entryDate(a).getTime() - entryDate(b).getTime());
  }, [entries, barnId, client]);

  // When client changes, pre-select all matching entries
  // (keep unassigned opt-in)
  const onPickClient = (c: ClientChoice | null) => {
    setClient(c);
    if (c) {
      // Initialize active horses for owner mode (all checked by default)
      if (c.kind === "owner") {
        setActiveHorseIds(new Set(c.horseIds));
      } else {
        setActiveHorseIds(new Set());
      }

      const ids = new Set<string>();
      for (const e of entries) {
        if (e.barn_id !== barnId) continue;
        if (c.kind === "user" && e.billable_to_user_id === c.id) {
          ids.add(`${e.source}:${e.id}`);
        } else if (c.kind === "name" && (e.billable_to_name ?? "").trim().toLowerCase() === c.name.trim().toLowerCase()) {
          ids.add(`${e.source}:${e.id}`);
        } else if (c.kind === "owner" && c.horseIds.includes(e.horse_id)) {
          ids.add(`${e.source}:${e.id}`);
        }
      }
      setIncludedIds(ids);
    } else {
      setIncludedIds(new Set());
      setActiveHorseIds(new Set());
    }
  };

  // Toggle a horse on/off — adds/removes all its entries from included
  const toggleHorse = (horseId: string) => {
    setActiveHorseIds((prev) => {
      const next = new Set(prev);
      if (next.has(horseId)) next.delete(horseId);
      else next.add(horseId);
      return next;
    });
    // Also toggle the entries for that horse
    setIncludedIds((prev) => {
      const next = new Set(prev);
      const isActivating = !activeHorseIds.has(horseId);
      for (const e of entries) {
        if (e.horse_id !== horseId) continue;
        const compoundId = `${e.source}:${e.id}`;
        if (isActivating) next.add(compoundId);
        else next.delete(compoundId);
      }
      return next;
    });
  };

  const toggle = (compoundId: string) => {
    setIncludedIds((prev) => {
      const next = new Set(prev);
      if (next.has(compoundId)) next.delete(compoundId);
      else next.add(compoundId);
      return next;
    });
  };

  // Step 4: Due date + notes + custom line items
  const todayIso = new Date().toISOString().slice(0, 10);
  const default30 = new Date();
  default30.setDate(default30.getDate() + 30);
  const [dueDate, setDueDate] = useState(default30.toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  // Draft custom line items — stored locally until invoice is created, then
  // inserted all at once via the create action.
  type DraftLineItem = {
    key: string;
    description: string;
    quantity: number;
    unit_price: number;
    horse_id: string | null;
  };
  const [draftLineItems, setDraftLineItems] = useState<DraftLineItem[]>([]);
  const [showAddLineItem, setShowAddLineItem] = useState(false);

  // Horses available for line item assignment — all horses in the selected barn
  const barnHorsesForLineItems = useMemo(() => {
    return Object.entries(horseNames)
      .map(([id, name]) => {
        const horseEntry = entries.find((e) => e.horse_id === id);
        return { id, name, barn_id: horseEntry?.barn_id ?? null };
      })
      .filter((h) => h.barn_id === barnId || !h.barn_id)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [horseNames, entries, barnId]);

  const addDraftLineItem = (li: Omit<DraftLineItem, "key">) => {
    setDraftLineItems((prev) => [...prev, { ...li, key: `li-${Date.now()}-${Math.random()}` }]);
  };
  const removeDraftLineItem = (key: string) => {
    setDraftLineItems((prev) => prev.filter((li) => li.key !== key));
  };

  // Totals
  const selectedEntries = useMemo(() => {
    return [...matchingEntries, ...unassignedEntries].filter((e) => includedIds.has(`${e.source}:${e.id}`));
  }, [matchingEntries, unassignedEntries, includedIds]);

  const entriesTotal = useMemo(
    () => selectedEntries.reduce((s, e) => s + (e.total_cost ?? 0), 0),
    [selectedEntries],
  );
  const lineItemsTotal = useMemo(
    () => draftLineItems.reduce((s, li) => s + li.quantity * li.unit_price, 0),
    [draftLineItems],
  );
  const total = entriesTotal + lineItemsTotal;

  // Allow creating with either entries OR line items (or both)
  const canSubmit = client && barnId && (includedIds.size > 0 || draftLineItems.length > 0) && !pending;

  const handleCreate = () => {
    if (!canSubmit || !client) return;
    const entriesArr = [...includedIds].map((id) => {
      const [source, eid] = id.split(":");
      return { id: eid, source: source as "activity" | "health" };
    });
    startTransition(async () => {
      const res = await createInvoiceAction({
        barnId,
        billable_to_user_id: client.kind === "user" ? client.id : null,
        billable_to_name:
          client.kind === "name" ? client.name :
          client.kind === "owner" ? client.name :
          null,
        due_date: dueDate || null,
        notes: notes.trim() || null,
        entryIds: entriesArr,
        lineItems: draftLineItems.map((li) => ({
          description: li.description,
          quantity: li.quantity,
          unit_price: li.unit_price,
          horse_id: li.horse_id,
        })),
      });
      if (res.error) {
        alert(`Failed: ${res.error}`);
        return;
      }
      if (res.invoiceId) {
        router.push(`/business-pro/invoicing/${res.invoiceId}`);
      }
    });
  };

  // Render
  return (
    <BusinessProChrome breadcrumb={breadcrumb}>
      <div className="bp-page-header">
        <h1 className="bp-display" style={{ fontSize: 32 }}>New Invoice</h1>
        <p style={{ color: "var(--bp-ink-secondary)", fontSize: 13, marginTop: 6 }}>
          Bundle unpaid entries into an invoice. Click to add, click to remove.
        </p>
      </div>

      <div style={{ padding: "0 32px 48px", maxWidth: 1000 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20, alignItems: "start" }}>
          {/* Left: picker */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Barn */}
            {barns.length > 1 && (
              <fieldset className="bp-fieldset">
                <legend className="bp-fieldset-legend">Barn</legend>
                <select
                  value={barnId}
                  onChange={(e) => { setBarnId(e.target.value); onPickClient(null); }}
                  className="bp-select"
                >
                  {barns.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </fieldset>
            )}

            {/* Client */}
            <fieldset className="bp-fieldset">
              <legend className="bp-fieldset-legend">Client</legend>

              {/* Horse Owners (from horses.owner_name in the selected barn) */}
              {(ownersByBarn[barnId]?.length ?? 0) > 0 && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 500, color: "var(--bp-ink-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                    Horse Owners
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                    {(ownersByBarn[barnId] ?? []).map((o) => {
                      const isActive = client?.kind === "owner" && client.name.toLowerCase() === o.name.toLowerCase();
                      return (
                        <button
                          key={`owner:${o.name}`}
                          type="button"
                          onClick={() => onPickClient({ kind: "owner", name: o.name, horseIds: o.horseIds })}
                          className={`bp-chip ${isActive ? "bp-active" : ""}`}
                          title={`${o.horseCount} ${o.horseCount === 1 ? "horse" : "horses"}`}
                        >
                          {o.name}
                          <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.6 }}>
                            · {o.horseCount}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Clients already referenced in existing entries */}
              {availableClients.length > 0 && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 500, color: "var(--bp-ink-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                    From Existing Entries
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                    {availableClients.map((c) => {
                      const label = c.kind === "user" ? c.display : c.name;
                      const isActive =
                        (c.kind === "user" && client?.kind === "user" && client.id === c.id) ||
                        (c.kind === "name" && client?.kind === "name" && client.name.trim().toLowerCase() === c.name.trim().toLowerCase());
                      return (
                        <button
                          key={c.kind === "user" ? `u:${c.id}` : `n:${c.name}`}
                          type="button"
                          onClick={() => onPickClient(c)}
                          className={`bp-chip ${isActive ? "bp-active" : ""}`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  placeholder="Or type a client name..."
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  className="bp-input"
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (manualName.trim()) {
                      onPickClient({ kind: "name", name: manualName.trim() });
                      setManualName("");
                    }
                  }}
                  className="bp-btn"
                  disabled={!manualName.trim()}
                >
                  Use
                </button>
              </div>
            </fieldset>

            {/* Horses (owner mode only) */}
            {client?.kind === "owner" && client.horseIds.length > 0 && (
              <fieldset className="bp-fieldset">
                <legend className="bp-fieldset-legend">
                  Horses ({activeHorseIds.size} of {client.horseIds.length} included)
                </legend>
                <p style={{ fontSize: 11, color: "var(--bp-ink-tertiary)", marginBottom: 8 }}>
                  Uncheck a horse to exclude all its entries from this invoice.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {client.horseIds.map((hid) => {
                    const isActive = activeHorseIds.has(hid);
                    return (
                      <button
                        key={hid}
                        type="button"
                        onClick={() => toggleHorse(hid)}
                        className={`bp-chip ${isActive ? "bp-active" : ""}`}
                        style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                      >
                        <input
                          type="checkbox"
                          checked={isActive}
                          onChange={() => {}}
                          style={{ pointerEvents: "none" }}
                        />
                        {horseNames[hid] ?? "Unknown"}
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveHorseIds(new Set(client.horseIds));
                      setIncludedIds((prev) => {
                        const next = new Set(prev);
                        for (const e of entries) {
                          if (client.horseIds.includes(e.horse_id) && e.barn_id === barnId) {
                            next.add(`${e.source}:${e.id}`);
                          }
                        }
                        return next;
                      });
                    }}
                    className="bp-btn"
                    style={{ fontSize: 11 }}
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveHorseIds(new Set());
                      setIncludedIds((prev) => {
                        const next = new Set(prev);
                        for (const e of entries) {
                          if (client.horseIds.includes(e.horse_id)) {
                            next.delete(`${e.source}:${e.id}`);
                          }
                        }
                        return next;
                      });
                    }}
                    className="bp-btn"
                    style={{ fontSize: 11 }}
                  >
                    Clear all
                  </button>
                </div>
              </fieldset>
            )}

            {/* Entries */}
            {client && (
              <fieldset className="bp-fieldset">
                <legend className="bp-fieldset-legend">
                  Entries ({includedIds.size} of {matchingEntries.length + unassignedEntries.length})
                </legend>

                {matchingEntries.length === 0 && unassignedEntries.length === 0 ? (
                  <p style={{ fontSize: 13, color: "var(--bp-ink-tertiary)", padding: "12px 0" }}>
                    No unpaid entries found for this client in this barn.
                  </p>
                ) : (
                  <>
                    {matchingEntries.length > 0 && (
                      <>
                        <div style={{ fontSize: 11, fontWeight: 500, color: "var(--bp-ink-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6, marginTop: 4 }}>
                          Billed to this client
                        </div>
                        <EntryPicker
                          entries={matchingEntries}
                          includedIds={includedIds}
                          toggle={toggle}
                          horseNames={horseNames}
                        />
                      </>
                    )}

                    {unassignedEntries.length > 0 && (
                      <>
                        <div style={{ fontSize: 11, fontWeight: 500, color: "var(--bp-ink-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6, marginTop: 12 }}>
                          Unassigned (click to include)
                        </div>
                        <EntryPicker
                          entries={unassignedEntries}
                          includedIds={includedIds}
                          toggle={toggle}
                          horseNames={horseNames}
                        />
                      </>
                    )}
                  </>
                )}
              </fieldset>
            )}

            {/* Custom Line Items — board, training, hauling, tax, adjustments */}
            {client && (
              <fieldset className="bp-fieldset">
                <legend className="bp-fieldset-legend">
                  Custom Line Items{draftLineItems.length > 0 ? ` (${draftLineItems.length})` : ""}
                </legend>
                <p style={{ fontSize: 11, color: "var(--bp-ink-tertiary)", marginBottom: 10 }}>
                  Add charges that aren&apos;t from log entries — boarding, training, hauling, etc.
                </p>

                {draftLineItems.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                    {draftLineItems.map((li) => {
                      const amt = li.quantity * li.unit_price;
                      const showQty = li.quantity !== 1;
                      return (
                        <div
                          key={li.key}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "8px 12px",
                            borderRadius: 6,
                            border: "1px solid var(--bp-border)",
                            background: "var(--bp-bg-elevated)",
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 500 }}>{li.description}</div>
                            {showQty && (
                              <div style={{ fontSize: 11, color: "var(--bp-ink-tertiary)", marginTop: 2 }}>
                                {li.quantity} × ${li.unit_price.toFixed(2)}
                              </div>
                            )}
                            {li.horse_id && horseNames[li.horse_id] && (
                              <div style={{ fontSize: 11, color: "var(--bp-ink-tertiary)", marginTop: 2 }}>
                                For: {horseNames[li.horse_id]}
                              </div>
                            )}
                          </div>
                          <span className="bp-mono" style={{ fontSize: 13, fontWeight: 500 }}>
                            ${amt.toFixed(2)}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeDraftLineItem(li.key)}
                            style={{
                              fontSize: 10,
                              padding: "2px 6px",
                              background: "transparent",
                              border: "none",
                              color: "#b91c1c",
                              cursor: "pointer",
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {showAddLineItem ? (
                  <DraftLineItemForm
                    barnHorses={barnHorsesForLineItems}
                    onCancel={() => setShowAddLineItem(false)}
                    onAdd={(input) => {
                      addDraftLineItem(input);
                      setShowAddLineItem(false);
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowAddLineItem(true)}
                    className="bp-btn"
                    style={{ fontSize: 12 }}
                  >
                    + Add Line Item
                  </button>
                )}
              </fieldset>
            )}

            {/* Details */}
            {client && (
              <fieldset className="bp-fieldset">
                <legend className="bp-fieldset-legend">Details</legend>
                <div className="bp-field-row">
                  <div>
                    <label className="bp-label">Due Date</label>
                    <input
                      type="date"
                      value={dueDate}
                      min={todayIso}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="bp-input"
                    />
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <label className="bp-label">Notes (shown on invoice)</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="bp-input"
                    placeholder="e.g., Thank you for your business!"
                    style={{ resize: "vertical" }}
                  />
                </div>
              </fieldset>
            )}
          </div>

          {/* Right: summary sidebar (sticky) */}
          <aside
            style={{
              position: "sticky",
              top: 80,
              background: "var(--bp-bg-elevated)",
              border: "1px solid var(--bp-border)",
              borderRadius: 8,
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--bp-ink-tertiary)" }}>
              Invoice Summary
            </div>
            {client ? (
              <div>
                <div style={{ fontSize: 12, color: "var(--bp-ink-tertiary)" }}>
                  {client.kind === "owner" ? "Horse Owner" : "Client"}
                </div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>
                  {client.kind === "user" ? client.display : client.name}
                </div>
                {client.kind === "owner" && (
                  <div style={{ fontSize: 11, color: "var(--bp-ink-tertiary)", marginTop: 2 }}>
                    {client.horseIds.length} {client.horseIds.length === 1 ? "horse" : "horses"}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: "var(--bp-ink-tertiary)" }}>
                Pick a client to begin.
              </div>
            )}
            {barnId && barns.length > 1 && (
              <div>
                <div style={{ fontSize: 12, color: "var(--bp-ink-tertiary)" }}>Barn</div>
                <div style={{ fontSize: 14 }}>{barnNames[barnId]}</div>
              </div>
            )}
            <div>
              <div style={{ fontSize: 12, color: "var(--bp-ink-tertiary)" }}>Entries</div>
              <div style={{ fontSize: 14 }}>
                {includedIds.size}
                {draftLineItems.length > 0 && (
                  <span style={{ color: "var(--bp-ink-tertiary)", fontSize: 12 }}>
                    {" + "}{draftLineItems.length} line item{draftLineItems.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "var(--bp-ink-tertiary)" }}>Total</div>
              <div className="bp-mono" style={{ fontSize: 22, fontWeight: 600, color: "var(--bp-ink)" }}>
                {formatCurrency(total)}
              </div>
            </div>

            <button
              type="button"
              onClick={handleCreate}
              disabled={!canSubmit}
              className="bp-btn bp-primary"
              style={{ marginTop: 8 }}
            >
              {pending
                ? "Creating..."
                : includedIds.size === 0 && draftLineItems.length > 0
                  ? "Create Invoice from Line Items"
                  : "Create Draft Invoice"}
            </button>
            <Link href="/business-pro/invoicing" className="bp-btn" style={{ textAlign: "center" }}>
              Cancel
            </Link>
          </aside>
        </div>

        {/* Helper: no log entries hint (still let the user create with line items) */}
        {entries.length === 0 && !client && (
          <div
            style={{
              marginTop: 24,
              background: "var(--bp-bg-elevated)",
              border: "1px solid var(--bp-border)",
              borderRadius: 8,
              padding: 16,
              color: "var(--bp-ink-tertiary)",
              fontSize: 12,
            }}
          >
            No unpaid log entries available — no worries. Pick a client above and add custom line items (board, training, hauling, etc.) to build an invoice from scratch.
          </div>
        )}
      </div>
    </BusinessProChrome>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Inline form for adding a draft line item on the Create Invoice page
// ──────────────────────────────────────────────────────────────────────────

function DraftLineItemForm({
  barnHorses,
  onAdd,
  onCancel,
}: {
  barnHorses: { id: string; name: string }[];
  onAdd: (input: { description: string; quantity: number; unit_price: number; horse_id: string | null }) => void;
  onCancel: () => void;
}) {
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [horseId, setHorseId] = useState("");

  const presets = [
    { label: "Monthly Board", desc: "Monthly Board" },
    { label: "Training", desc: "Training Package" },
    { label: "Lesson", desc: "Lesson" },
    { label: "Hauling", desc: "Hauling Fee" },
    { label: "Tax", desc: "Sales Tax" },
  ];

  const preview = (parseFloat(quantity) || 0) * (parseFloat(unitPrice) || 0);
  const canSubmit =
    description.trim() &&
    Number.isFinite(parseFloat(quantity)) &&
    Number.isFinite(parseFloat(unitPrice));

  return (
    <div
      style={{
        background: "var(--bp-bg)",
        border: "1px solid var(--bp-border)",
        borderRadius: 8,
        padding: 14,
        marginTop: 4,
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => setDescription(p.desc)}
            className="bp-chip"
            style={{ fontSize: 11 }}
          >
            + {p.label}
          </button>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 80px 120px 160px",
          gap: 8,
          alignItems: "end",
        }}
      >
        <div>
          <label className="bp-label">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g., Monthly Board"
            className="bp-input"
            autoFocus
          />
        </div>
        <div>
          <label className="bp-label">Qty</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="bp-input"
          />
        </div>
        <div>
          <label className="bp-label">Unit Price</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            placeholder="0.00"
            className="bp-input"
          />
        </div>
        <div>
          <label className="bp-label">Horse (optional)</label>
          <select
            value={horseId}
            onChange={(e) => setHorseId(e.target.value)}
            className="bp-select"
          >
            <option value="">No horse</option>
            {barnHorses.map((h) => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 12,
        }}
      >
        <span className="bp-mono" style={{ fontSize: 13, fontWeight: 500 }}>
          {preview > 0 ? `$${preview.toFixed(2)}` : " "}
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={onCancel} className="bp-btn" style={{ fontSize: 12 }}>
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => {
              onAdd({
                description: description.trim(),
                quantity: parseFloat(quantity),
                unit_price: parseFloat(unitPrice),
                horse_id: horseId || null,
              });
            }}
            className="bp-btn bp-primary"
            style={{ fontSize: 12 }}
          >
            Add Line Item
          </button>
        </div>
      </div>
    </div>
  );
}

function EntryPicker({
  entries,
  includedIds,
  toggle,
  horseNames,
}: {
  entries: Entry[];
  includedIds: Set<string>;
  toggle: (id: string) => void;
  horseNames: Record<string, string>;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {entries.map((e) => {
        const compoundId = `${e.source}:${e.id}`;
        const isIncluded = includedIds.has(compoundId);
        const d = entryDate(e);
        return (
          <button
            key={compoundId}
            type="button"
            onClick={() => toggle(compoundId)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              borderRadius: 6,
              border: `1px solid ${isIncluded ? "var(--bp-accent)" : "var(--bp-border)"}`,
              background: isIncluded ? "rgba(201, 168, 76, 0.08)" : "var(--bp-bg-elevated)",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <input
              type="checkbox"
              checked={isIncluded}
              onChange={() => { /* button handler */ }}
              style={{ cursor: "pointer", flexShrink: 0, pointerEvents: "none" }}
            />
            <span className="bp-mono" style={{ fontSize: 11, color: "var(--bp-ink-tertiary)", minWidth: 60 }}>
              {d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" })}
            </span>
            <span style={{ fontSize: 13, fontWeight: 500, minWidth: 110 }}>
              {horseNames[e.horse_id] ?? "Unknown"}
            </span>
            <span style={{ fontSize: 11, color: "var(--bp-ink-tertiary)", textTransform: "capitalize", minWidth: 90 }}>
              {entryType(e).replace(/_/g, " ")}
            </span>
            <span style={{ flex: 1, fontSize: 11, color: "var(--bp-ink-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
              {e.notes ?? ""}
            </span>
            <span className="bp-mono" style={{ fontSize: 13, fontWeight: 500, color: "var(--bp-ink)" }}>
              {formatCurrency(e.total_cost ?? 0)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
