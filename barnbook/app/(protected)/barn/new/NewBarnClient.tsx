"use client";

import { createBarnAction } from "@/app/(protected)/actions/barn";
import Link from "next/link";
import { useActionState, useState } from "react";

const fieldClass =
  "w-full rounded-xl border border-barn-dark/15 bg-white px-4 py-3 text-barn-dark outline-none transition focus:border-brass-gold focus:ring-2 focus:ring-brass-gold/25";

const TIERS = [
  { value: "free", label: "Starter Barn", stalls: "5 stalls", price: "Free", note: "Perfect for getting started", available: true },
  { value: "small", label: "Small Barn", stalls: "10 stalls", price: "$29/mo", per: "$2.90/stall", available: true },
  { value: "medium", label: "Medium Barn", stalls: "20 stalls", price: "$49/mo", per: "$2.45/stall", popular: true, available: true },
  { value: "large", label: "Large Barn", stalls: "40 stalls", price: "$79/mo", per: "$1.98/stall", available: true },
  { value: "estate", label: "Estate Barn", stalls: "80 stalls", price: "$129/mo", per: "$1.61/stall", available: true },
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

      {/* Homestead Banner */}
      <div className="mt-6 rounded-xl border border-brass-gold/30 bg-brass-gold/10 px-4 py-3">
        <p className="text-sm font-medium text-barn-dark">
          <span className="text-brass-gold">✦</span>{" "}
          Homestead Territory — All barns are free with unlimited stalls during the Homestead period.
          Build whatever you want, keep it forever.
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
                  You already have a free barn. Additional barns will use paid pricing when Homestead ends.
                </p>
              )}
              {visibleTiers.map((tier) => (
                <label
                  key={tier.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition hover:border-brass-gold ${
                    selectedTier === tier.value
                      ? "border-brass-gold bg-brass-gold/5"
                      : "border-barn-dark/15 bg-white"
                  } ${tier.popular ? "ring-1 ring-brass-gold/40" : ""}`}
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
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-barn-dark">{tier.label}</p>
                      {tier.popular && (
                        <span className="rounded-full bg-brass-gold/20 px-2 py-0.5 text-[10px] font-semibold text-barn-dark uppercase tracking-wider">
                          Popular
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-barn-dark/55">{tier.stalls}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-barn-dark">
                      {tier.value === "free" ? (
                        "Free"
                      ) : (
                        <>
                          <span className="line-through text-barn-dark/40 text-xs mr-1">{tier.price}</span>
                          <span className="text-forest font-bold">Free</span>
                        </>
                      )}
                    </p>
                    {tier.value !== "free" && (
                      <p className="text-[10px] text-brass-gold font-medium">Homestead pricing</p>
                    )}
                  </div>
                </label>
              ))}
              <p className="text-xs text-barn-dark/40 mt-1">
                During Homestead Territory, all tiers are free with unlimited stalls. Pricing shown is what will apply after Homestead ends.
              </p>
            </div>
          )}

          {!showTierSelect && (
            <p className="text-xs text-barn-dark/50">
              Default: unlimited stalls (Homestead pricing). Click above to preview future tiers.
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
