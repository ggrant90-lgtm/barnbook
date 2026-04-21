"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createQuickRecordAction } from "@/app/(protected)/actions/quick-records";
import type { Barn } from "@/lib/types";
import { ErrorDetails } from "@/components/ui/ErrorDetails";

const inputClass =
  "w-full rounded-xl border border-barn-dark/15 bg-white px-4 py-3 text-barn-dark outline-none focus:border-brass-gold focus:ring-2 focus:ring-brass-gold/25";

/**
 * The 15-second-between-horses quick-record form. No photo, no breed,
 * no registration — the spec calls out explicitly that we must not
 * bloat it. Just the fields a mobile service provider needs to log
 * their work and bill the owner.
 */
export function NewQuickRecordForm({ barn }: { barn: Barn }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [locationName, setLocationName] = useState("");
  const [color, setColor] = useState("");
  const [notes, setNotes] = useState("");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createQuickRecordAction({
        serviceBarnId: barn.id,
        name,
        ownerName: ownerName || null,
        ownerPhone: ownerPhone || null,
        ownerEmail: ownerEmail || null,
        locationName: locationName || null,
        color: color || null,
        notes: notes || null,
      });
      if (res.error || !res.horseId) {
        setError(res.error ?? "Couldn't create quick record");
        return;
      }
      router.push(`/barn/${barn.id}/service`);
    });
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <Link
        href={`/barn/${barn.id}/service`}
        className="text-sm text-barn-dark/70 hover:text-brass-gold"
      >
        ← {barn.name}
      </Link>
      <h1 className="mt-6 font-serif text-3xl font-semibold text-barn-dark">
        Add a quick record
      </h1>
      <p className="mt-2 text-barn-dark/70">
        A lightweight entry for a horse at a barn that doesn&apos;t use
        BarnBook.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-3">
        <LabeledInput
          label="Horse name *"
          value={name}
          onChange={setName}
          required
          autoFocus
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <LabeledInput
            label="Owner name (optional)"
            value={ownerName}
            onChange={setOwnerName}
          />
          <LabeledInput
            label="Color (optional)"
            value={color}
            onChange={setColor}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <LabeledInput
            label="Owner phone (optional)"
            value={ownerPhone}
            onChange={setOwnerPhone}
            type="tel"
          />
          <LabeledInput
            label="Owner email (optional)"
            value={ownerEmail}
            onChange={setOwnerEmail}
            type="email"
          />
        </div>
        <LabeledInput
          label="Location / barn name (optional)"
          value={locationName}
          onChange={setLocationName}
          placeholder="e.g. Smith Ranch, Williamson Valley Rd"
        />
        <div>
          <label
            className="mb-1.5 block text-sm font-medium text-barn-dark/80"
            htmlFor="notes"
          >
            Notes (optional)
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className={inputClass}
            placeholder="Anything worth remembering for next visit?"
          />
        </div>

        {error && (
          <ErrorDetails
            title="Couldn't save"
            message={error}
            extra={{ Barn: barn.id }}
          />
        )}

        <div className="flex gap-2 pt-2">
          <Link
            href={`/barn/${barn.id}/service`}
            className="min-h-[44px] inline-flex items-center rounded-xl border px-4 py-2 text-sm font-medium text-barn-dark hover:bg-parchment"
            style={{ borderColor: "rgba(42,64,49,0.15)" }}
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={pending || !name.trim()}
            className="min-h-[48px] flex-1 rounded-xl px-4 py-3 font-medium shadow disabled:opacity-60"
            style={{ background: "#c9a84c", color: "#2a4031" }}
          >
            {pending ? "Saving…" : "Save quick record"}
          </button>
        </div>
      </form>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-barn-dark/80">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        autoFocus={autoFocus}
        placeholder={placeholder}
        className={inputClass}
      />
    </div>
  );
}
