"use client";

import { useState } from "react";
import { createLogAction } from "@/app/(protected)/actions/create-log";
import { getLogTypeLabel } from "@/lib/logTypeColors";

interface Horse { id: string; name: string }
interface BarnMember { id: string; name: string; role: string }

const LOG_TYPES = [
  "exercise", "feed", "medication", "note", "breed_data",
  "shoeing", "worming", "vet_visit",
];

const inputClass =
  "w-full rounded-xl border border-barn-dark/15 bg-white px-4 py-3 text-barn-dark outline-none focus:border-brass-gold focus:ring-2 focus:ring-brass-gold/25";

export function CalendarQuickAdd({
  barnId,
  horses,
  barnMembers,
  currentUserId,
  defaultDate,
  defaultTime,
  onClose,
  onCreated,
}: {
  barnId: string;
  horses: Horse[];
  barnMembers: BarnMember[];
  currentUserId: string;
  defaultDate: string;
  defaultTime: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [horseId, setHorseId] = useState(horses[0]?.id ?? "");
  const [logType, setLogType] = useState("exercise");
  const [performedBy, setPerformedBy] = useState(currentUserId);
  const [performedAt, setPerformedAt] = useState(`${defaultDate}T${defaultTime}`);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!horseId) return;
    setSubmitting(true);
    setError(null);

    const formData = new FormData();
    formData.set("performed_at", performedAt);
    formData.set("performed_by_user_id", performedBy);
    formData.set("notes", notes);
    formData.set("logged_at", defaultDate);
    formData.set("record_date", defaultDate);

    const result = await createLogAction(horseId, logType, formData);
    if (result.error) {
      setError(result.error);
      setSubmitting(false);
    } else {
      onCreated();
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed inset-x-4 top-[10%] z-50 mx-auto max-w-md rounded-2xl border border-barn-dark/10 bg-white p-6 shadow-2xl sm:inset-x-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-lg font-semibold text-barn-dark">Quick Add</h2>
          <button type="button" onClick={onClose} className="text-barn-dark/40 hover:text-barn-dark text-xl">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm text-barn-dark/75">Horse</label>
            <select value={horseId} onChange={(e) => setHorseId(e.target.value)} className={inputClass} required>
              {horses.map((h) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm text-barn-dark/75">Type</label>
            <select value={logType} onChange={(e) => setLogType(e.target.value)} className={inputClass}>
              {LOG_TYPES.map((t) => (
                <option key={t} value={t}>{getLogTypeLabel(t)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm text-barn-dark/75">When</label>
            <input
              type="datetime-local"
              value={performedAt}
              onChange={(e) => setPerformedAt(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-barn-dark/75">Performed by</label>
            <select value={performedBy} onChange={(e) => setPerformedBy(e.target.value)} className={inputClass}>
              {barnMembers.map((m) => (
                <option key={m.id} value={m.id}>{m.name} — {m.role}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm text-barn-dark/75">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className={inputClass}
              placeholder="Quick note…"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 border border-red-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full min-h-[44px] items-center justify-center rounded-xl bg-brass-gold px-4 py-2.5 font-medium text-barn-dark shadow hover:brightness-110 disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Save entry"}
          </button>
        </form>
      </div>
    </>
  );
}
