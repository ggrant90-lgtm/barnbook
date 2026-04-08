"use client";

import Link from "next/link";

export function UpgradeModal({
  barnName,
  currentCapacity,
  onClose,
}: {
  barnName: string;
  barnId?: string;
  currentCapacity: number;
  isAddition?: boolean;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="fixed inset-0 bg-black/40" />
      <div
        className="relative z-10 w-full max-w-md rounded-2xl bg-white p-8 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-barn-dark/40 hover:bg-barn-dark/5"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Barn full icon */}
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50">
          <svg className="h-8 w-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>

        <h2 className="text-center font-serif text-2xl font-semibold text-barn-dark">
          Your Barn is Full
        </h2>
        <p className="mt-3 text-center text-sm text-barn-dark/70">
          <strong>{barnName}</strong> has reached its {currentCapacity}-stall limit.
          To add more horses, create a new barn.
        </p>

        {/* Option: Add a new barn */}
        <div className="mt-6 space-y-3">
          <Link
            href="/barn/new"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brass-gold px-4 py-3.5 font-medium text-barn-dark shadow transition hover:brightness-110"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add a New Barn
          </Link>

          <div className="rounded-xl border border-barn-dark/10 bg-parchment/50 p-4">
            <div className="flex items-start gap-3">
              <div className="shrink-0 mt-0.5">
                <svg className="h-5 w-5 text-brass-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-barn-dark">Barn Pricing</p>
                <p className="mt-1 text-xs text-barn-dark/60">
                  Your first barn is <strong>free</strong> with 5 stalls.
                  Additional barns are <strong>$25/mo</strong> for 10 stalls.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full text-center text-sm text-barn-dark/50 hover:text-barn-dark transition"
          >
            Go back
          </button>
        </div>
      </div>
    </div>
  );
}
