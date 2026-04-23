"use client";

import { createBarnAction } from "@/app/(protected)/actions/barn";
import {
  BARN_TYPE_DESCRIPTIONS,
  BARN_TYPE_LABELS,
  BARN_TYPE_NAME_PLACEHOLDERS,
  type BarnType,
} from "@/lib/barn-types";
import Link from "next/link";
import { useActionState, useState } from "react";

const fieldClass =
  "w-full rounded-xl border border-barn-dark/15 bg-white px-4 py-3 text-barn-dark outline-none transition focus:border-brass-gold focus:ring-2 focus:ring-brass-gold/25";

export function NewBarnClient({ hasFreeBarn }: { hasFreeBarn: boolean }) {
  const [state, formAction, pending] = useActionState(createBarnAction, null);
  const [barnType, setBarnType] = useState<BarnType>("standard");
  const isService = barnType === "service";

  return (
    <div className="mx-auto max-w-lg px-4 py-10 sm:px-6">
      <Link href="/dashboard" className="text-sm font-medium text-barn-dark/70 hover:text-brass-gold">
        &larr; Dashboard
      </Link>
      <h1 className="mt-6 font-serif text-3xl font-semibold text-barn-dark">Build your barn</h1>
      <p className="mt-2 text-barn-dark/70">
        Pick a barn type, then give it a name.
      </p>

      {/* Pricing banner — only meaningful for standard barns. Service
          Barns are always free with unlimited stalls, so we hide the
          Homestead / upsell strip when Service is selected. */}
      {!isService && (hasFreeBarn ? (
        <div className="mt-6 rounded-xl border border-brass-gold/30 bg-brass-gold/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-brass-gold">&#10022;</span>
            <p className="text-sm font-medium text-barn-dark">
              10-stall barn &mdash;{" "}
              <span className="line-through text-barn-dark/40 text-xs">$25/mo</span>{" "}
              <span className="text-forest font-bold">Free</span>
            </p>
          </div>
          <p className="mt-1 text-xs text-brass-gold font-medium">
            Homestead Territory &mdash; build now, keep it free forever. Pricing applies after Homestead ends.
          </p>
        </div>
      ) : (
        <div className="mt-6 rounded-xl border border-brass-gold/30 bg-brass-gold/10 px-4 py-3">
          <p className="text-sm font-medium text-barn-dark">
            <span className="text-brass-gold">&#10022;</span>{" "}
            Your first barn is free with 5 stalls. Welcome to BarnBook!
          </p>
        </div>
      ))}

      {isService && (
        <div
          className="mt-6 rounded-xl border px-4 py-3"
          style={{ borderColor: "rgba(75,100,121,0.35)", background: "rgba(75,100,121,0.08)" }}
        >
          <p className="text-sm font-medium text-barn-dark">
            <span style={{ color: "#4b6479" }}>&#9876;</span>{" "}
            Service Barns are free with unlimited capacity. Track every horse you work on in one place.
          </p>
        </div>
      )}

      <form action={formAction} className="mt-8 space-y-4">
        <input type="hidden" name="plan_tier_selected" value={hasFreeBarn && !isService ? "paid" : "free"} />
        <input type="hidden" name="barn_type" value={barnType} />

        {/* Barn type picker — three cards. */}
        <fieldset>
          <legend className="mb-1.5 block text-sm font-medium text-barn-dark/80">
            Barn type
          </legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {(["standard", "mare_motel", "service"] as BarnType[]).map((t) => {
              const active = barnType === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setBarnType(t)}
                  aria-pressed={active}
                  className="rounded-xl border px-3 py-3 text-left transition"
                  style={{
                    borderColor: active ? "#c9a84c" : "rgba(42,64,49,0.12)",
                    background: active ? "rgba(201,168,76,0.08)" : "white",
                  }}
                >
                  <div className="font-medium text-barn-dark text-sm">
                    {BARN_TYPE_LABELS[t]}
                  </div>
                  <div className="mt-0.5 text-xs text-barn-dark/60 leading-snug">
                    {BARN_TYPE_DESCRIPTIONS[t]}
                  </div>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div>
          <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-barn-dark/80">
            Barn name <span className="text-barn-red">*</span>
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            className={fieldClass}
            placeholder={BARN_TYPE_NAME_PLACEHOLDERS[barnType]}
          />
        </div>

        {/* Physical address doesn't apply to Service Barns (providers
            are mobile). Hide the fields entirely when Service is
            selected; the server action accepts them blank. */}
        {!isService && (
          <>
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
          </>
        )}

        {/* Phone is still useful for Service Barns (a provider's
            business number), so surface it on its own. */}
        {isService && (
          <div>
            <label htmlFor="phone" className="mb-1.5 block text-sm font-medium text-barn-dark/80">
              Business phone (optional)
            </label>
            <input id="phone" name="phone" type="tel" className={fieldClass} />
          </div>
        )}

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
          {pending ? "Building your barn\u2026" : isService ? "Build service barn" : "Build barn"}
        </button>
      </form>
    </div>
  );
}
