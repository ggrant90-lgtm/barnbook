"use client";

import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

const inputClass =
  "w-full rounded-xl border border-brass-gold/25 bg-barn-dark px-4 py-3 text-parchment placeholder:text-muted-tan/60 outline-none transition focus:border-brass-gold focus:ring-2 focus:ring-brass-gold/30";

function safeNextParam(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  return raw;
}

function mapAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login") || m.includes("invalid credentials"))
    return "Incorrect email or password.";
  if (m.includes("email not confirmed"))
    return "Confirm your email before signing in. Check your inbox.";
  return message;
}

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextParam(searchParams.get("next"));
  const urlError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    urlError === "callback"
      ? "We couldn’t complete sign-in from the link. Try again."
      : null,
  );
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }

    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);

    if (signInError) {
      setError(mapAuthError(signInError.message));
      return;
    }

    router.push(next);
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-5 py-12 sm:px-8">
      <div className="mb-8 text-center">
        <p className="font-serif text-3xl text-parchment">BarnBook</p>
        <h1 className="mt-2 text-lg text-muted-tan">Sign in</h1>
      </div>

      <form
        onSubmit={onSubmit}
        className="rounded-2xl border border-brass-gold/20 bg-barn-panel p-6 shadow-lg shadow-black/40 sm:p-8"
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm text-muted-tan">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              required
            />
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <label htmlFor="password" className="text-sm text-muted-tan">
                Password
              </label>
              <span
                className="text-xs text-muted-tan/80"
                title="Password reset coming soon"
              >
                Forgot password?
              </span>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              required
            />
          </div>
        </div>

        {error ? (
          <p
            className="mt-4 rounded-lg border border-barn-red/40 bg-barn-red/15 px-3 py-2 text-sm text-parchment"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="mt-6 flex min-h-[48px] w-full items-center justify-center rounded-xl bg-brass-gold px-4 py-3.5 font-medium text-barn-dark shadow-md transition hover:brightness-110 disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>

        <p className="mt-6 text-center text-sm text-muted-tan">
          Need an account?{" "}
          <Link href="/auth/signup" className="font-medium text-brass-gold underline-offset-2 hover:underline">
            Sign up
          </Link>
        </p>
      </form>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-full items-center justify-center px-5 py-16 text-muted-tan">
          Loading…
        </div>
      }
    >
      <SignInForm />
    </Suspense>
  );
}
