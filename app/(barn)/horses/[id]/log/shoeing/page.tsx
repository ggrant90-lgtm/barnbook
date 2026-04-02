"use client";

import { useHorseName } from "@/hooks/useHorseName";
import { supabase } from "@/lib/supabase";
import { todayISODate } from "@/lib/today";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

const SHOE_TYPES = [
  "Full Set (4)",
  "Front Only (2)",
  "Hind Only (2)",
  "Pulled Shoes (Barefoot)",
  "Reset",
  "Trim Only",
] as const;

const SHOE_MATERIALS = [
  "Aluminum (racing plates)",
  "Steel",
  "Titanium",
  "Glue-On",
  "Barefoot/N/A",
] as const;

export default function ShoeingLogPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";
  const { name, loading: nameLoading } = useHorseName(id);

  const [farrierName, setFarrierName] = useState("");
  const [shoeType, setShoeType] = useState<(typeof SHOE_TYPES)[number]>(
    "Full Set (4)",
  );
  const [shoeMaterial, setShoeMaterial] = useState<
    (typeof SHOE_MATERIALS)[number]
  >("Steel");
  const [notes, setNotes] = useState("");
  const [recordDate, setRecordDate] = useState(todayISODate);
  const [nextAppointment, setNextAppointment] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedFarrier = farrierName.trim();
    if (!trimmedFarrier) {
      setError("Please enter the farrier name.");
      return;
    }

    const description = `${shoeType} — ${shoeMaterial}`;

    setSubmitting(true);
    const { error: insertError } = await supabase.from("health_records").insert({
      horse_id: id,
      record_type: "Shoeing",
      provider_name: trimmedFarrier,
      description,
      notes: notes.trim() || null,
      record_date: recordDate,
      next_due_date: nextAppointment.trim() || null,
      document_url: null,
    });

    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    router.push(`/horses/${id}?log=success`);
  }

  if (!id) {
    return (
      <div className="min-h-full bg-parchment px-4 py-16 text-center text-oak">
        Invalid link.
      </div>
    );
  }

  return (
    <div className="min-h-full bg-parchment pb-10">
      <div className="border-b border-border-warm bg-cream px-4 py-3 sm:px-6">
        <Link
          href={`/horses/${id}/log`}
          className="text-sm font-semibold text-brass hover:text-brass-light"
        >
          ← Log menu
        </Link>
      </div>

      <main className="mx-auto max-w-lg px-4 pt-6 sm:px-6">
        <p className="text-center text-xs font-medium uppercase tracking-wider text-brass">
          Shoeing
        </p>
        <h1 className="mt-2 text-center text-2xl font-bold tracking-tight text-barn-dark">
          {nameLoading ? "Loading…" : name ?? "Horse"}
        </h1>
        <p className="mt-1 text-center text-sm text-oak">
          Farrier visit &amp; shoeing details
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          {error ? (
            <div
              className="rounded-xl border border-alert/30 bg-alert/10 px-4 py-3 text-sm text-alert"
              role="alert"
            >
              {error}
            </div>
          ) : null}

          <div>
            <label
              htmlFor="farrier"
              className="block text-sm font-medium text-oak"
            >
              Farrier name <span className="text-alert">*</span>
            </label>
            <input
              id="farrier"
              type="text"
              value={farrierName}
              onChange={(e) => setFarrierName(e.target.value)}
              className="mt-2 min-h-12 w-full rounded-xl border border-border-warm bg-white px-4 py-3 text-base text-barn-dark shadow-sm outline-none focus:border-brass focus:ring-2 focus:ring-brass/25"
              placeholder="Name"
              autoComplete="name"
            />
          </div>

          <div>
            <label
              htmlFor="shoe_type"
              className="block text-sm font-medium text-oak"
            >
              Shoe type
            </label>
            <select
              id="shoe_type"
              value={shoeType}
              onChange={(e) =>
                setShoeType(e.target.value as (typeof SHOE_TYPES)[number])
              }
              className="mt-2 min-h-12 w-full rounded-xl border border-border-warm bg-white px-4 py-3 text-base text-barn-dark shadow-sm outline-none focus:border-brass focus:ring-2 focus:ring-brass/25"
            >
              {SHOE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="shoe_material"
              className="block text-sm font-medium text-oak"
            >
              Shoe material
            </label>
            <select
              id="shoe_material"
              value={shoeMaterial}
              onChange={(e) =>
                setShoeMaterial(
                  e.target.value as (typeof SHOE_MATERIALS)[number],
                )
              }
              className="mt-2 min-h-12 w-full rounded-xl border border-border-warm bg-white px-4 py-3 text-base text-barn-dark shadow-sm outline-none focus:border-brass focus:ring-2 focus:ring-brass/25"
            >
              {SHOE_MATERIALS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="notes"
              className="block text-sm font-medium text-oak"
            >
              Notes
            </label>
            <textarea
              id="notes"
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-2 w-full rounded-xl border border-border-warm bg-white px-4 py-3 text-base text-barn-dark shadow-sm outline-none focus:border-brass focus:ring-2 focus:ring-brass/25"
              placeholder="Hoof condition, concerns, comments"
            />
          </div>

          <div>
            <label
              htmlFor="record_date"
              className="block text-sm font-medium text-oak"
            >
              Date of service
            </label>
            <input
              id="record_date"
              type="date"
              value={recordDate}
              onChange={(e) => setRecordDate(e.target.value)}
              className="mt-2 min-h-12 w-full rounded-xl border border-border-warm bg-white px-4 py-3 text-base text-barn-dark shadow-sm outline-none focus:border-brass focus:ring-2 focus:ring-brass/25"
            />
          </div>

          <div>
            <label
              htmlFor="next_appt"
              className="block text-sm font-medium text-oak"
            >
              Next appointment (optional)
            </label>
            <input
              id="next_appt"
              type="date"
              value={nextAppointment}
              onChange={(e) => setNextAppointment(e.target.value)}
              className="mt-2 min-h-12 w-full rounded-xl border border-border-warm bg-white px-4 py-3 text-base text-barn-dark shadow-sm outline-none focus:border-brass focus:ring-2 focus:ring-brass/25"
            />
          </div>

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <Link
              href={`/horses/${id}/log`}
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-border-warm bg-cream px-6 text-base font-semibold text-barn-dark hover:bg-parchment"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-brass px-6 text-base font-semibold text-barn-dark shadow-sm hover:bg-brass-light disabled:opacity-60"
            >
              {submitting ? "Saving…" : "Save shoeing"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
