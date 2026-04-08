"use client";

import { createBarnAction } from "@/app/(protected)/actions/barn";
import Link from "next/link";
import { useActionState } from "react";

const fieldClass =
  "w-full rounded-xl border border-barn-dark/15 bg-white px-4 py-3 text-barn-dark outline-none transition focus:border-brass-gold focus:ring-2 focus:ring-brass-gold/25";

export function NewBarnClient({ hasFreeBarn }: { hasFreeBarn: boolean }) {
  const [state, formAction, pending] = useActionState(createBarnAction, null);

  return (
    <div className="mx-auto max-w-lg px-4 py-10 sm:px-6">
      <Link href="/dashboard" className="text-sm font-medium text-barn-dark/70 hover:text-brass-gold">
        &larr; Dashboard
      </Link>
      <h1 className="mt-6 font-serif text-3xl font-semibold text-barn-dark">Build your barn</h1>
      <p className="mt-2 text-barn-dark/70">
        Add your facility so you can manage horses, keys, and team access in one place.
      </p>

      {/* Barn info banner */}
      {hasFreeBarn ? (
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
      )}

      {/* Hidden input: paid if they already have a free barn, free otherwise */}
      <form action={formAction} className="mt-8 space-y-4">
        <input type="hidden" name="plan_tier_selected" value={hasFreeBarn ? "paid" : "free"} />

        <div>
          <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-barn-dark/80">
            Barn name <span className="text-barn-red">*</span>
          </label>
          <input id="name" name="name" type="text" required className={fieldClass} placeholder="Oak Hollow Stables" />
        </div>

        <input type="hidden" name="barn_type" value="standard" />

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
          {pending ? "Building your barn\u2026" : "Build barn"}
        </button>
      </form>
    </div>
  );
}
