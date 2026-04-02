"use client";

import { useHorseName } from "@/hooks/useHorseName";
import { supabase } from "@/lib/supabase";
import { todayISODate } from "@/lib/today";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

const PRODUCTS = [
  "Ivermectin (Zimecterin)",
  "Moxidectin (Quest)",
  "Fenbendazole (Panacur/Safe-Guard)",
  "Pyrantel (Strongid)",
  "Praziquantel + Ivermectin (Equimax/Zimecterin Gold)",
  "Praziquantel + Moxidectin (Quest Plus)",
  "Other",
] as const;

export default function WormingLogPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";
  const { name, loading: nameLoading } = useHorseName(id);

  const [product, setProduct] = useState<(typeof PRODUCTS)[number]>(
    "Ivermectin (Zimecterin)",
  );
  const [customProduct, setCustomProduct] = useState("");
  const [administeredBy, setAdministeredBy] = useState("");
  const [weightLbs, setWeightLbs] = useState("");
  const [notes, setNotes] = useState("");
  const [recordDate, setRecordDate] = useState(todayISODate);
  const [nextDue, setNextDue] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showCustomProduct = product === "Other";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const by = administeredBy.trim();
    if (!by) {
      setError('Please enter who administered the dewormer ("Administered by").');
      return;
    }

    if (product === "Other" && !customProduct.trim()) {
      setError("Please enter the product name.");
      return;
    }

    const desc = product === "Other" ? customProduct.trim() : product;
    if (!desc) {
      setError("Please enter a product name.");
      return;
    }

    const noteParts: string[] = [];
    if (weightLbs.trim() !== "") {
      const w = parseFloat(weightLbs.replace(",", "."));
      if (Number.isNaN(w)) {
        setError("Weight must be a valid number.");
        return;
      }
      noteParts.push(`Weight (dosing): ${w} lbs`);
    }
    if (notes.trim()) noteParts.push(notes.trim());
    const fullNotes = noteParts.length ? noteParts.join("\n\n") : null;

    setSubmitting(true);
    const { error: insertError } = await supabase.from("health_records").insert({
      horse_id: id,
      record_type: "Worming",
      provider_name: by,
      description: desc,
      notes: fullNotes,
      record_date: recordDate,
      next_due_date: nextDue.trim() || null,
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
          Worming
        </p>
        <h1 className="mt-2 text-center text-2xl font-bold tracking-tight text-barn-dark">
          {nameLoading ? "Loading…" : name ?? "Horse"}
        </h1>
        <p className="mt-1 text-center text-sm text-oak">
          Deworming treatment
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
              htmlFor="product"
              className="block text-sm font-medium text-oak"
            >
              Product name
            </label>
            <select
              id="product"
              value={product}
              onChange={(e) =>
                setProduct(e.target.value as (typeof PRODUCTS)[number])
              }
              className="mt-2 min-h-12 w-full rounded-xl border border-border-warm bg-white px-4 py-3 text-base text-barn-dark shadow-sm outline-none focus:border-brass focus:ring-2 focus:ring-brass/25"
            >
              {PRODUCTS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {showCustomProduct ? (
            <div>
              <label
                htmlFor="custom_product"
                className="block text-sm font-medium text-oak"
              >
                Custom product name <span className="text-alert">*</span>
              </label>
              <input
                id="custom_product"
                type="text"
                value={customProduct}
                onChange={(e) => setCustomProduct(e.target.value)}
                className="mt-2 min-h-12 w-full rounded-xl border border-border-warm bg-white px-4 py-3 text-base text-barn-dark shadow-sm outline-none focus:border-brass focus:ring-2 focus:ring-brass/25"
                placeholder="Product name"
              />
            </div>
          ) : null}

          <div>
            <label
              htmlFor="admin_by"
              className="block text-sm font-medium text-oak"
            >
              Administered by <span className="text-alert">*</span>
            </label>
            <input
              id="admin_by"
              type="text"
              value={administeredBy}
              onChange={(e) => setAdministeredBy(e.target.value)}
              className="mt-2 min-h-12 w-full rounded-xl border border-border-warm bg-white px-4 py-3 text-base text-barn-dark shadow-sm outline-none focus:border-brass focus:ring-2 focus:ring-brass/25"
              placeholder="Who gave the dewormer"
            />
          </div>

          <div>
            <label
              htmlFor="weight"
              className="block text-sm font-medium text-oak"
            >
              Weight used for dosing (lbs, optional)
            </label>
            <input
              id="weight"
              type="text"
              inputMode="decimal"
              value={weightLbs}
              onChange={(e) => setWeightLbs(e.target.value)}
              className="mt-2 min-h-12 w-full rounded-xl border border-border-warm bg-white px-4 py-3 text-base text-barn-dark shadow-sm outline-none focus:border-brass focus:ring-2 focus:ring-brass/25"
              placeholder="e.g. 1100"
            />
          </div>

          <div>
            <label
              htmlFor="worm_notes"
              className="block text-sm font-medium text-oak"
            >
              Notes
            </label>
            <textarea
              id="worm_notes"
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-2 w-full rounded-xl border border-border-warm bg-white px-4 py-3 text-base text-barn-dark shadow-sm outline-none focus:border-brass focus:ring-2 focus:ring-brass/25"
              placeholder="Additional details"
            />
          </div>

          <div>
            <label
              htmlFor="record_date"
              className="block text-sm font-medium text-oak"
            >
              Date administered
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
              htmlFor="next_due"
              className="block text-sm font-medium text-oak"
            >
              Next due date (optional)
            </label>
            <input
              id="next_due"
              type="date"
              value={nextDue}
              onChange={(e) => setNextDue(e.target.value)}
              className="mt-2 min-h-12 w-full rounded-xl border border-border-warm bg-white px-4 py-3 text-base text-barn-dark shadow-sm outline-none focus:border-brass focus:ring-2 focus:ring-brass/25"
            />
            <p className="mt-1.5 text-xs text-oak">
              Often 8–12 weeks after treatment.
            </p>
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
              {submitting ? "Saving…" : "Save worming"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
