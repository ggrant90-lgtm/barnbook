"use client";

import { createBarnAction } from "@/app/(protected)/actions/barn";
import Link from "next/link";
import { useActionState } from "react";

const fieldClass =
  "w-full rounded-xl border border-barn-dark/15 bg-white px-4 py-3 text-barn-dark outline-none transition focus:border-brass-gold focus:ring-2 focus:ring-brass-gold/25";

export default function NewBarnPage() {
  const [state, formAction, pending] = useActionState(createBarnAction, null);

  return (
    <div className="mx-auto max-w-lg px-4 py-10 sm:px-6">
      <Link href="/dashboard" className="text-sm font-medium text-barn-dark/70 hover:text-brass-gold">
        ← Dashboard
      </Link>
      <h1 className="mt-6 font-serif text-3xl font-semibold text-barn-dark">Create your barn</h1>
      <p className="mt-2 text-barn-dark/70">
        Add your facility so you can manage horses, keys, and team access in one place.
      </p>

      <form action={formAction} className="mt-10 space-y-4">
        <div>
          <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-barn-dark/80">
            Barn name <span className="text-barn-red">*</span>
          </label>
          <input id="name" name="name" type="text" required className={fieldClass} placeholder="Oak Hollow Stables" />
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
          {pending ? "Creating…" : "Create barn"}
        </button>
      </form>
    </div>
  );
}
