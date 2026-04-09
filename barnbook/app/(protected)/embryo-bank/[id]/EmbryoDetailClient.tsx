"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Embryo } from "@/lib/types";
import {
  EMBRYO_STATUS_LABELS,
  EMBRYO_GRADE_LABELS,
  EMBRYO_STAGE_LABELS,
  FREEZE_METHOD_LABELS,
  LOSS_REASON_LABELS,
  type EmbryoStatus,
} from "@/lib/horse-form-constants";
import {
  transferEmbryoAction,
  freezeEmbryoAction,
  shipEmbryoAction,
  markEmbryoLostAction,
} from "@/app/(protected)/actions/embryo";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
  FREEZE_METHODS,
  LOSS_REASONS,
} from "@/lib/horse-form-constants";

function statusColor(status: EmbryoStatus): string {
  switch (status) {
    case "in_bank_fresh": return "bg-green-100 text-green-800";
    case "in_bank_frozen": return "bg-blue-100 text-blue-800";
    case "transferred": return "bg-amber-100 text-amber-800";
    case "became_foal": return "bg-brass-gold/20 text-barn-dark";
    case "shipped_out": return "bg-purple-100 text-purple-800";
    case "lost": return "bg-red-100 text-red-800";
    default: return "bg-gray-100 text-gray-800";
  }
}

type ModalType = "transfer" | "freeze" | "ship" | "lost" | null;

export function EmbryoDetailClient({
  embryo,
  horseNames,
  canEdit,
  surrogates,
}: {
  embryo: Embryo;
  horseNames: Record<string, string>;
  canEdit: boolean;
  surrogates: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const donorName = horseNames[embryo.donor_horse_id] ?? "Unknown";
  const stallionName = embryo.stallion_horse_id
    ? (horseNames[embryo.stallion_horse_id] ?? "Unknown")
    : (embryo.external_stallion_name ?? "External");

  const canTransfer = embryo.status === "in_bank_fresh" || embryo.status === "in_bank_frozen";
  const canFreeze = embryo.status === "in_bank_fresh";
  const canShip = embryo.status === "in_bank_fresh" || embryo.status === "in_bank_frozen";
  const canMarkLost = embryo.status === "in_bank_fresh" || embryo.status === "in_bank_frozen";

  async function handleAction(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const formData = new FormData(e.currentTarget);

    let result: { error?: string };
    switch (activeModal) {
      case "transfer":
        result = await transferEmbryoAction(embryo.id, formData);
        break;
      case "freeze":
        result = await freezeEmbryoAction(embryo.id, formData);
        break;
      case "ship":
        result = await shipEmbryoAction(embryo.id, formData);
        break;
      case "lost":
        result = await markEmbryoLostAction(embryo.id, formData);
        break;
      default:
        result = { error: "Unknown action" };
    }

    if (result.error) {
      setError(result.error);
      setSaving(false);
      return;
    }

    setActiveModal(null);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* Back link */}
      <Link
        href="/embryo-bank"
        className="inline-flex items-center gap-1 text-sm text-barn-dark/50 hover:text-barn-dark transition"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
        Embryo Bank
      </Link>

      {/* Header */}
      <div className="mt-4 flex items-start justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-barn-dark">{embryo.embryo_code}</h1>
          <p className="mt-1 text-sm text-barn-dark/60">
            <Link href={`/horses/${embryo.donor_horse_id}`} className="hover:text-brass-gold transition">
              {donorName}
            </Link>
            {" x "}
            {embryo.stallion_horse_id ? (
              <Link href={`/horses/${embryo.stallion_horse_id}`} className="hover:text-brass-gold transition">
                {stallionName}
              </Link>
            ) : (
              <span>{stallionName}</span>
            )}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-medium ${statusColor(embryo.status)}`}>
          {EMBRYO_STATUS_LABELS[embryo.status]}
        </span>
      </div>

      {/* Details */}
      <div className="mt-6 rounded-xl border border-barn-dark/10 bg-white p-5 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-barn-dark/50">Grade</p>
            <p className="text-sm text-barn-dark">{EMBRYO_GRADE_LABELS[embryo.grade]}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-barn-dark/50">Stage</p>
            <p className="text-sm text-barn-dark">{EMBRYO_STAGE_LABELS[embryo.stage]}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-barn-dark/50">Created</p>
            <p className="text-sm text-barn-dark">{new Date(embryo.created_at).toLocaleDateString()}</p>
          </div>
          {embryo.notes && (
            <div className="sm:col-span-2">
              <p className="text-xs font-medium text-barn-dark/50">Notes</p>
              <p className="text-sm text-barn-dark">{embryo.notes}</p>
            </div>
          )}
        </div>

        {/* Frozen details */}
        {embryo.status === "in_bank_frozen" && (
          <div className="mt-4 border-t border-barn-dark/10 pt-4">
            <h3 className="text-xs font-semibold text-barn-dark/60 uppercase tracking-wide">Storage</h3>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {embryo.storage_facility && (
                <div>
                  <p className="text-xs text-barn-dark/50">Facility</p>
                  <p className="text-sm text-barn-dark">{embryo.storage_facility}</p>
                </div>
              )}
              {embryo.storage_tank && (
                <div>
                  <p className="text-xs text-barn-dark/50">Tank</p>
                  <p className="text-sm text-barn-dark">{embryo.storage_tank}</p>
                </div>
              )}
              {embryo.storage_cane && (
                <div>
                  <p className="text-xs text-barn-dark/50">Cane</p>
                  <p className="text-sm text-barn-dark">{embryo.storage_cane}</p>
                </div>
              )}
              {embryo.storage_position && (
                <div>
                  <p className="text-xs text-barn-dark/50">Position</p>
                  <p className="text-sm text-barn-dark">{embryo.storage_position}</p>
                </div>
              )}
              {embryo.freeze_date && (
                <div>
                  <p className="text-xs text-barn-dark/50">Freeze Date</p>
                  <p className="text-sm text-barn-dark">{new Date(embryo.freeze_date).toLocaleDateString()}</p>
                </div>
              )}
              {embryo.freeze_method && (
                <div>
                  <p className="text-xs text-barn-dark/50">Method</p>
                  <p className="text-sm text-barn-dark">{FREEZE_METHOD_LABELS[embryo.freeze_method]}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Shipped details */}
        {embryo.status === "shipped_out" && (
          <div className="mt-4 border-t border-barn-dark/10 pt-4">
            <h3 className="text-xs font-semibold text-barn-dark/60 uppercase tracking-wide">Shipment</h3>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {embryo.shipped_to && (
                <div>
                  <p className="text-xs text-barn-dark/50">Shipped To</p>
                  <p className="text-sm text-barn-dark">{embryo.shipped_to}</p>
                </div>
              )}
              {embryo.ship_date && (
                <div>
                  <p className="text-xs text-barn-dark/50">Ship Date</p>
                  <p className="text-sm text-barn-dark">{new Date(embryo.ship_date).toLocaleDateString()}</p>
                </div>
              )}
              {embryo.sale_price != null && (
                <div>
                  <p className="text-xs text-barn-dark/50">Sale Price</p>
                  <p className="text-sm text-barn-dark">${embryo.sale_price.toLocaleString()}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Lost details */}
        {embryo.status === "lost" && (
          <div className="mt-4 border-t border-barn-dark/10 pt-4">
            <h3 className="text-xs font-semibold text-barn-dark/60 uppercase tracking-wide">Loss</h3>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {embryo.loss_reason && (
                <div>
                  <p className="text-xs text-barn-dark/50">Reason</p>
                  <p className="text-sm text-barn-dark">{LOSS_REASON_LABELS[embryo.loss_reason]}</p>
                </div>
              )}
              {embryo.loss_date && (
                <div>
                  <p className="text-xs text-barn-dark/50">Date</p>
                  <p className="text-sm text-barn-dark">{new Date(embryo.loss_date).toLocaleDateString()}</p>
                </div>
              )}
              {embryo.loss_notes && (
                <div className="sm:col-span-2">
                  <p className="text-xs text-barn-dark/50">Notes</p>
                  <p className="text-sm text-barn-dark">{embryo.loss_notes}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      {canEdit && (canTransfer || canFreeze || canShip || canMarkLost) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {canTransfer && (
            <Button variant="primary" onClick={() => setActiveModal("transfer")}>
              Transfer to Surrogate
            </Button>
          )}
          {canFreeze && (
            <Button variant="secondary" onClick={() => setActiveModal("freeze")}>
              Freeze
            </Button>
          )}
          {canShip && (
            <Button variant="secondary" onClick={() => setActiveModal("ship")}>
              Ship Out
            </Button>
          )}
          {canMarkLost && (
            <Button variant="secondary" onClick={() => setActiveModal("lost")}>
              Mark Lost
            </Button>
          )}
        </div>
      )}

      {/* Action Modals */}
      {activeModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          onClick={() => setActiveModal(null)}
        >
          <div className="fixed inset-0 bg-black/40" />
          <div
            className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-barn-dark">
                {activeModal === "transfer" && "Transfer to Surrogate"}
                {activeModal === "freeze" && "Freeze Embryo"}
                {activeModal === "ship" && "Ship Embryo"}
                {activeModal === "lost" && "Mark as Lost"}
              </h2>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="rounded-lg p-1.5 text-barn-dark/40 hover:bg-barn-dark/5 hover:text-barn-dark"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {error && (
              <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
            )}

            <form onSubmit={handleAction} className="space-y-4">
              {/* Transfer form */}
              {activeModal === "transfer" && (
                <>
                  <Select name="surrogate_horse_id" label="Surrogate Mare">
                    <option value="">Select surrogate...</option>
                    {surrogates.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </Select>
                  <Input
                    name="transfer_date"
                    label="Transfer Date"
                    type="date"
                    defaultValue={new Date().toISOString().slice(0, 10)}
                  />
                  <Input name="transfer_veterinarian_name" label="Veterinarian" placeholder="Dr. Smith" />
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-barn-dark/70">Notes</label>
                    <textarea
                      name="notes"
                      rows={2}
                      className="w-full rounded-xl border border-barn-dark/15 bg-white px-3 py-2.5 text-sm text-barn-dark placeholder:text-barn-dark/35 focus:border-brass-gold focus:outline-none focus:ring-2 focus:ring-brass-gold/30"
                      placeholder="Optional notes..."
                    />
                  </div>
                </>
              )}

              {/* Freeze form */}
              {activeModal === "freeze" && (
                <>
                  <Input name="storage_facility" label="Storage Facility" placeholder="ABC Embryo Storage" />
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Input name="storage_tank" label="Tank" placeholder="Tank A" />
                    <Input name="storage_cane" label="Cane" placeholder="Cane 3" />
                    <Input name="storage_position" label="Position" placeholder="Pos 2" />
                  </div>
                  <Input
                    name="freeze_date"
                    label="Freeze Date"
                    type="date"
                    defaultValue={new Date().toISOString().slice(0, 10)}
                  />
                  <Select name="freeze_method" label="Freeze Method" defaultValue="vitrification">
                    {FREEZE_METHODS.map((m) => (
                      <option key={m} value={m}>{FREEZE_METHOD_LABELS[m]}</option>
                    ))}
                  </Select>
                </>
              )}

              {/* Ship form */}
              {activeModal === "ship" && (
                <>
                  <Input name="shipped_to" label="Shipped To" placeholder="Buyer name or ranch" />
                  <Input
                    name="ship_date"
                    label="Ship Date"
                    type="date"
                    defaultValue={new Date().toISOString().slice(0, 10)}
                  />
                  <Input name="sale_price" label="Sale Price ($)" type="number" step="0.01" min={0} placeholder="0.00" />
                </>
              )}

              {/* Loss form */}
              {activeModal === "lost" && (
                <>
                  <Select name="loss_reason" label="Reason" defaultValue="other">
                    {LOSS_REASONS.map((r) => (
                      <option key={r} value={r}>{LOSS_REASON_LABELS[r]}</option>
                    ))}
                  </Select>
                  <Input
                    name="loss_date"
                    label="Date"
                    type="date"
                    defaultValue={new Date().toISOString().slice(0, 10)}
                  />
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-barn-dark/70">Notes</label>
                    <textarea
                      name="loss_notes"
                      rows={2}
                      className="w-full rounded-xl border border-barn-dark/15 bg-white px-3 py-2.5 text-sm text-barn-dark placeholder:text-barn-dark/35 focus:border-brass-gold focus:outline-none focus:ring-2 focus:ring-brass-gold/30"
                      placeholder="Optional notes..."
                    />
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => setActiveModal(null)} block>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={saving} block>
                  {saving ? "Saving..." : "Confirm"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
