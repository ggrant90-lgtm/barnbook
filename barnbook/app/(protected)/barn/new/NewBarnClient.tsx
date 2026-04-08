"use client";

import { createBarnAction } from "@/app/(protected)/actions/barn";
import Link from "next/link";
import { useActionState, useState } from "react";

const fieldClass =
  "w-full rounded-xl border border-barn-dark/15 bg-white px-4 py-3 text-barn-dark outline-none transition focus:border-brass-gold focus:ring-2 focus:ring-brass-gold/25";

const TIERS = [
  { value: "free", label: "Free Barn", stalls: "5 stalls", price: "Free" },
  { value: "paid", label: "10-Stall Barn", stalls: "10 stalls", price: "$25/mo" },
];

export function NewBarnClient({ hasFreeBarn }: { hasFreeBarn: boolean }) {
  const [state, formAction, pending] = useActionState(createBarnAction, null);
  const [selectedTier, setSelectedTier] = useState(hasFreeBarn ? "small" : "free");
  const [showTierSelect, setShowTierSelect] = useState(hasFreeBarn);

  const visibleTiers = hasFreeBarn
    ? TIERS.filter((t) => t.value !== "free")
    : TIERS;

  return (
    <div className="mx-auto max-w-lg px-4 py-10 sm:px-6">
      <Link href="/dashboard" className="text-sm font-medium text-barn-dark/70 hover:text-brass-gold">
        ← Dashboard
      </Link>
      <h1 className="mt-6 font-serif text-3xl font-semibold text-barn-dark">Build your barn</h1>
      <p className="mt-2 text-barn-dark/70">
        Add your facility so you can manage horses, keys, and team access in one place.
      </p>

      {/* Pricing info */}
      <div className="mt-6 rounded-xl border border-brass-gold/30 bg-brass-gold/10 px-4 py-3">
        <p className="text-sm font-medium text-barn-dark">
          <span className="text-brass-gold">✦</span>{" "}
          Your first barn is free with 5 stalls. Need more room? Add a 10-stall barn for $25/mo.
        </p>
      </div>

      <form action={formAction} className="mt-8 space-y-4">
        <div>
          <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-barn-dark/80">
            Barn name <span className="text-barn-red">*</span>
          </label>
          <input id="name" name="name" type="text" required className={fieldClass} placeholder="Oak Hollow Stables" />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-barn-dark/80">Barn type</label>
          <div className="mt-1 space-y-2">
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-barn-dark/15 bg-white px-4 py-3 transition hover:border-brass-gold">
              <input type="radio" name="barn_type" value="standard" defaultChecked className="mt-0.5 accent-[#c9a84c]" />
              <div>
                <p className="text-sm font-medium text-barn-dark">Standard Barn</p>
                <p className="text-xs text-barn-dark/55">A regular barn for managing your horses and team</p>
              </div>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-barn-dark/15 bg-white px-4 py-3 transition hover:border-brass-gold">
              <input type="radio" name="barn_type" value="mare_motel" className="mt-0.5 accent-[#c9a84c]" />
              <div>
                <p className="text-sm font-medium text-barn-dark">Mare Motel</p>
                <p className="text-xs text-barn-dark/55">A breeding facility where horses come and go</p>
              </div>
            </label>
          </div>
        </div>

        {/* Plan Size Selector */}
        <div>
          <button
            type="button"
            onClick={() => setShowTierSelect(!showTierSelect)}
            className="mb-1.5 flex items-center gap-2 text-sm font-medium text-barn-dark/80"
          >
            Choose your barn size
            <svg className={`h-4 w-4 transition-transform ${showTierSelect ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
            </svg>
          </button>

          {showTierSelect && (
            <div className="mt-2 space-y-2">
              {hasFreeBarn && (
                <p className="text-xs text-barn-dark/50 mb-2">
                  You already have a free barn. Additional barns are $25/mo for 10 stalls.
                </p>
              )}
              {visibleTiers.map((tier) => (
                <label
                  key={tier.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition hover:border-brass-gold ${
                    selectedTier === tier.value
                      ? "border-brass-gold bg-brass-gold/5"
                      : "border-barn-dark/15 bg-white"
                  }`}
                >
                  <input
                    type="radio"
                    name="plan_tier_selected"
                    value={tier.value}
                    checked={selectedTier === tier.value}
                    onChange={() => setSelectedTier(tier.value)}
                    className="mt-0.5 accent-[#c9a84c]"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-barn-dark">{tier.label}</p>
                    <p className="text-xs text-barn-dark/55">{tier.stalls}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-barn-dark">{tier.price}</p>
                  </div>
                </label>
              ))}
            </div>
          )}

          {!showTierSelect && (
            <p className="text-xs text-barn-dark/50">
              {hasFreeBarn ? "10 stalls — $25/mo" : "Free — 5 stalls"}. Click above to change.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="address" className="mb-1.5 block text-sm font-medium text-barn-dark/80">
            Address
          </label>
          <input id="address" name="address" type="text" className={fieldClass} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="city" className="mb-1.5 block text-sm font-medium text-barn-dark/80">
              City
            </label>
            <input id="city" name="city" type="text" className={fieldClass} />
          </div>
          <div>
            <label htmlFor="state" className="mb-1.5 block text-sm font-medium text-barn-dark/80">
              State
            </label>
            <input id="state" name="state" type="text" className={fieldClass} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="zip" className="mb-1.5 block text-sm font-medium text-barn-dark/80">
              ZIP
            </label>
            <input id="zip" name="zip" type="text" className={fieldClass} />
          </div>
          <div>
            <label htmlFor="phone" className="mb-1.5 block text-sm font-medium text-barn-dark/80">
              Phone
            </label>
            <input id="phone" name="phone" type="tel" className={fieldClass} />
          </div>
        </div>

        {state?.error ? (
          <p className="rounded-lg border border-barn-red/40 bg-barn-red/10 px-3 py-2 text-sm text-barn-dark" role="alert">
            {state.error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="mt-2 flex min-h-[48px] w-full items-center justify-center rounded-xl bg-brass-gold px-4 py-3 font-medium text-barn-dark shadow transition hover:brightness-110 disabled:opacity-60"
        >
          {pending ? "Building your barn…" : "Build barn"}
        </button>
      </form>
    </div>
  );
}
