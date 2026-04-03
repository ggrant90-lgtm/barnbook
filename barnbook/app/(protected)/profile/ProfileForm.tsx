"use client";

import { updateProfileAction } from "@/app/(protected)/actions/profile";
import { useActionState } from "react";

const fieldClass =
  "w-full rounded-xl border border-barn-dark/15 bg-white px-4 py-3 text-barn-dark outline-none transition focus:border-brass-gold focus:ring-2 focus:ring-brass-gold/25";

export function ProfileForm({
  email,
  initialFullName,
  initialPhone,
  initialAvatarUrl,
}: {
  email: string;
  initialFullName: string;
  initialPhone: string;
  initialAvatarUrl: string;
}) {
  const [state, formAction, pending] = useActionState(updateProfileAction, null);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="full_name" className="mb-1.5 block text-sm font-medium text-barn-dark/80">
          Name
        </label>
        <input
          id="full_name"
          name="full_name"
          type="text"
          defaultValue={initialFullName}
          className={fieldClass}
          autoComplete="name"
        />
      </div>
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-barn-dark/80">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          value={email}
          readOnly
          className={`${fieldClass} cursor-not-allowed bg-barn-dark/5`}
        />
        <p className="mt-1 text-xs text-barn-dark/55">Email is managed through your login provider.</p>
      </div>
      <div>
        <label htmlFor="phone" className="mb-1.5 block text-sm font-medium text-barn-dark/80">
          Phone
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          defaultValue={initialPhone}
          className={fieldClass}
          autoComplete="tel"
        />
      </div>
      <div>
        <label htmlFor="avatar_url" className="mb-1.5 block text-sm font-medium text-barn-dark/80">
          Avatar URL
        </label>
        <input
          id="avatar_url"
          name="avatar_url"
          type="url"
          defaultValue={initialAvatarUrl}
          className={fieldClass}
          placeholder="https://…"
        />
      </div>

      {state?.error ? (
        <p className="rounded-lg border border-barn-red/40 bg-barn-red/10 px-3 py-2 text-sm text-barn-dark" role="alert">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p className="rounded-lg border border-barn-green/40 bg-barn-green/10 px-3 py-2 text-sm text-barn-dark">
          Profile saved.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="flex min-h-[44px] items-center justify-center rounded-xl bg-brass-gold px-6 py-2.5 font-medium text-barn-dark shadow hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
