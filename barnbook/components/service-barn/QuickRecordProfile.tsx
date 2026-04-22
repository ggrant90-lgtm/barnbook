"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ActivityLog, HealthRecord, Horse } from "@/lib/types";
import { updateQuickRecordAction } from "@/app/(protected)/actions/quick-records";
import { deleteHorseAction } from "@/app/(protected)/actions/horse";
import { getActivitySummary, getHealthSummary } from "@/lib/horse-display";
import { LOG_TYPES, logTypeLabel } from "@/lib/horse-form-constants";
import { ErrorDetails } from "@/components/ui/ErrorDetails";

/**
 * Simplified single-page profile for a Service Barn quick record.
 *
 * Layout:
 *   - Header: horse name, owner contact card (tappable phone/email),
 *     location, color, notes, Edit button.
 *   - Activity list: log entries, newest first. "Add entry" routes
 *     into the existing log-entry forms just like a regular horse.
 *
 * Deliberately no tabs. Quick records have no health / breeding /
 * documents / access concepts — just contact info and a running list
 * of work performed.
 */

interface Props {
  horse: Horse;
  canEdit: boolean;
  activityLogs: ActivityLog[];
  healthRecords: HealthRecord[];
}

export function QuickRecordProfile({
  horse,
  canEdit,
  activityLogs,
  healthRecords,
}: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Editable buffers. Initialized from horse; reset when entering edit mode.
  const [name, setName] = useState(horse.name);
  const [ownerName, setOwnerName] = useState(horse.owner_contact_name ?? "");
  const [ownerPhone, setOwnerPhone] = useState(horse.owner_contact_phone ?? "");
  const [ownerEmail, setOwnerEmail] = useState(horse.owner_contact_email ?? "");
  const [locationName, setLocationName] = useState(horse.location_name ?? "");
  const [color, setColor] = useState(horse.color ?? "");
  const [notes, setNotes] = useState(horse.special_care_notes ?? "");
  const [showLogTypes, setShowLogTypes] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      // Quick records get a permanent delete — soft-archiving doesn't
      // help a service provider keep their list clean, and quick
      // records have no complex dependencies to preserve.
      const res = await deleteHorseAction(horse.id, true);
      if (res.error) {
        setError(res.error);
        setConfirmingDelete(false);
        return;
      }
      router.push(`/barn/${horse.barn_id}/service`);
      router.refresh();
    });
  }

  function saveEdits() {
    setError(null);
    startTransition(async () => {
      const res = await updateQuickRecordAction({
        horseId: horse.id,
        name,
        ownerName,
        ownerPhone,
        ownerEmail,
        locationName,
        color,
        notes,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  // Merge activity + health into one chronological list for display.
  type Entry =
    | { kind: "activity"; id: string; label: string; at: string }
    | { kind: "health"; id: string; label: string; at: string };
  const entries: Entry[] = [
    ...activityLogs.map((a) => ({
      kind: "activity" as const,
      id: a.id,
      label: `${logTypeLabel(a.activity_type)} — ${getActivitySummary(a)}`,
      at: a.performed_at ?? a.created_at,
    })),
    ...healthRecords.map((h) => ({
      kind: "health" as const,
      id: h.id,
      label: `${h.record_type} — ${getHealthSummary(h)}`,
      at: h.performed_at ?? h.created_at,
    })),
  ].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <Link
        href={`/barn/${horse.barn_id}/service`}
        className="text-sm text-barn-dark/70 hover:text-brass-gold"
      >
        ← Service Barn
      </Link>

      {/* Header card */}
      <div
        className="mt-4 rounded-2xl border bg-white p-5 shadow-sm"
        style={{ borderColor: "rgba(42,64,49,0.1)" }}
      >
        {editing ? (
          <EditForm
            name={name}
            setName={setName}
            ownerName={ownerName}
            setOwnerName={setOwnerName}
            ownerPhone={ownerPhone}
            setOwnerPhone={setOwnerPhone}
            ownerEmail={ownerEmail}
            setOwnerEmail={setOwnerEmail}
            locationName={locationName}
            setLocationName={setLocationName}
            color={color}
            setColor={setColor}
            notes={notes}
            setNotes={setNotes}
            onCancel={() => {
              // Reset to server values.
              setName(horse.name);
              setOwnerName(horse.owner_contact_name ?? "");
              setOwnerPhone(horse.owner_contact_phone ?? "");
              setOwnerEmail(horse.owner_contact_email ?? "");
              setLocationName(horse.location_name ?? "");
              setColor(horse.color ?? "");
              setNotes(horse.special_care_notes ?? "");
              setEditing(false);
              setError(null);
            }}
            onSave={saveEdits}
            pending={pending}
          />
        ) : (
          <>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <h1 className="font-serif text-3xl font-semibold text-barn-dark">
                  {horse.name}
                </h1>
                <div
                  className="mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide"
                  style={{ background: "rgba(201,168,76,0.18)", color: "#7a5c13" }}
                >
                  Quick Record
                </div>
              </div>
              {canEdit && (
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    disabled={pending}
                    className="rounded-lg border px-3 py-1.5 text-xs font-medium text-barn-dark hover:bg-parchment disabled:opacity-50"
                    style={{ borderColor: "rgba(42,64,49,0.15)" }}
                  >
                    Edit
                  </button>
                  {confirmingDelete ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-barn-dark/55">
                        Delete?
                      </span>
                      <button
                        type="button"
                        onClick={handleDelete}
                        disabled={pending}
                        className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                        style={{ background: "#b8421f" }}
                      >
                        {pending ? "…" : "Yes, delete"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingDelete(false)}
                        disabled={pending}
                        className="rounded-lg border px-2.5 py-1.5 text-xs text-barn-dark/70"
                        style={{ borderColor: "rgba(42,64,49,0.15)" }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(true)}
                      disabled={pending}
                      className="rounded-lg border px-3 py-1.5 text-xs font-medium text-barn-dark/60 hover:text-[#b8421f] hover:border-[#b8421f]/40 disabled:opacity-50"
                      style={{ borderColor: "rgba(42,64,49,0.15)" }}
                      title="Delete this quick record"
                    >
                      Delete
                    </button>
                  )}
                </div>
              )}
            </div>

            <dl className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
              <Field label="Owner" value={horse.owner_contact_name ?? "—"} />
              <Field
                label="Phone"
                value={
                  horse.owner_contact_phone ? (
                    <a
                      href={`tel:${horse.owner_contact_phone}`}
                      className="text-brass-gold underline"
                    >
                      {horse.owner_contact_phone}
                    </a>
                  ) : (
                    "—"
                  )
                }
              />
              <Field
                label="Email"
                value={
                  horse.owner_contact_email ? (
                    <a
                      href={`mailto:${horse.owner_contact_email}`}
                      className="text-brass-gold underline break-all"
                    >
                      {horse.owner_contact_email}
                    </a>
                  ) : (
                    "—"
                  )
                }
              />
              <Field label="Location" value={horse.location_name ?? "—"} />
              <Field label="Color" value={horse.color ?? "—"} />
              {horse.special_care_notes && (
                <div className="sm:col-span-2">
                  <div
                    className="text-[11px] font-medium uppercase tracking-wide"
                    style={{ color: "rgba(42,64,49,0.55)" }}
                  >
                    Notes
                  </div>
                  <div className="mt-0.5 text-sm text-barn-dark whitespace-pre-wrap">
                    {horse.special_care_notes}
                  </div>
                </div>
              )}
            </dl>
          </>
        )}

        {error && (
          <div className="mt-3">
            <ErrorDetails
              title="Couldn't save"
              message={error}
              extra={{ Horse: horse.id }}
            />
          </div>
        )}
      </div>

      {/* Activity list */}
      <div className="mt-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-serif text-lg font-semibold text-barn-dark">
            Activity
          </h2>
          {canEdit && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowLogTypes((v) => !v)}
                aria-expanded={showLogTypes}
                className="rounded-lg px-3 py-1.5 text-sm font-medium shadow inline-flex items-center gap-1.5"
                style={{ background: "#c9a84c", color: "#2a4031" }}
              >
                + Add entry
                <svg
                  className="h-3 w-3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m19.5 8.25-7.5 7.5-7.5-7.5"
                  />
                </svg>
              </button>
              {showLogTypes && (
                <>
                  <button
                    type="button"
                    aria-hidden="true"
                    onClick={() => setShowLogTypes(false)}
                    className="fixed inset-0 z-40 cursor-default"
                    style={{ background: "transparent" }}
                  />
                  <div
                    role="menu"
                    className="absolute right-0 z-50 mt-1 w-48 overflow-hidden rounded-lg border bg-white shadow-lg"
                    style={{ borderColor: "rgba(42,64,49,0.15)" }}
                  >
                    {LOG_TYPES.map((t) => (
                      <Link
                        key={t}
                        href={`/horses/${horse.id}/log/${t}`}
                        role="menuitem"
                        onClick={() => setShowLogTypes(false)}
                        className="block px-4 py-2 text-sm text-barn-dark hover:bg-parchment"
                      >
                        {logTypeLabel(t)}
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        {entries.length === 0 ? (
          <p className="mt-4 text-sm text-barn-dark/60">
            No entries yet. Log your first visit to {horse.name}.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {entries.slice(0, 25).map((e) => (
              <li
                key={`${e.kind}-${e.id}`}
                className="rounded-xl border bg-white px-4 py-2.5 text-sm"
                style={{ borderColor: "rgba(42,64,49,0.1)" }}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span style={{ color: "#2a4031" }}>{e.label}</span>
                  <span className="text-xs text-barn-dark/55">
                    {new Date(e.at).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <dt
        className="text-[11px] font-medium uppercase tracking-wide"
        style={{ color: "rgba(42,64,49,0.55)" }}
      >
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-barn-dark">{value}</dd>
    </div>
  );
}

function EditForm({
  name,
  setName,
  ownerName,
  setOwnerName,
  ownerPhone,
  setOwnerPhone,
  ownerEmail,
  setOwnerEmail,
  locationName,
  setLocationName,
  color,
  setColor,
  notes,
  setNotes,
  onCancel,
  onSave,
  pending,
}: {
  name: string;
  setName: (v: string) => void;
  ownerName: string;
  setOwnerName: (v: string) => void;
  ownerPhone: string;
  setOwnerPhone: (v: string) => void;
  ownerEmail: string;
  setOwnerEmail: (v: string) => void;
  locationName: string;
  setLocationName: (v: string) => void;
  color: string;
  setColor: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  onCancel: () => void;
  onSave: () => void;
  pending: boolean;
}) {
  const inputClass =
    "w-full rounded-xl border border-barn-dark/15 bg-white px-3 py-2 text-sm outline-none focus:border-brass-gold focus:ring-2 focus:ring-brass-gold/25";
  return (
    <div className="space-y-3">
      <LabeledRow label="Name" value={name} onChange={setName} className={inputClass} />
      <div className="grid gap-3 sm:grid-cols-2">
        <LabeledRow label="Owner" value={ownerName} onChange={setOwnerName} className={inputClass} />
        <LabeledRow label="Color" value={color} onChange={setColor} className={inputClass} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <LabeledRow label="Phone" value={ownerPhone} onChange={setOwnerPhone} className={inputClass} type="tel" />
        <LabeledRow label="Email" value={ownerEmail} onChange={setOwnerEmail} className={inputClass} type="email" />
      </div>
      <LabeledRow label="Location" value={locationName} onChange={setLocationName} className={inputClass} />
      <div>
        <div className="mb-1 text-[11px] font-medium uppercase tracking-wide" style={{ color: "rgba(42,64,49,0.55)" }}>
          Notes
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className={inputClass}
        />
      </div>
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="rounded-lg border px-3 py-1.5 text-sm font-medium text-barn-dark hover:bg-parchment disabled:opacity-50"
          style={{ borderColor: "rgba(42,64,49,0.15)" }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={pending || !name.trim()}
          className="rounded-lg px-4 py-1.5 text-sm font-semibold shadow disabled:opacity-60"
          style={{ background: "#c9a84c", color: "#2a4031" }}
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

function LabeledRow({
  label,
  value,
  onChange,
  className,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span
        className="mb-1 block text-[11px] font-medium uppercase tracking-wide"
        style={{ color: "rgba(42,64,49,0.55)" }}
      >
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={className}
      />
    </label>
  );
}
