"use client";

import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useState } from "react";

const inputClass =
  "w-full rounded-xl border border-brass-gold/25 bg-barn-dark px-4 py-3 text-parchment placeholder:text-muted-tan/60 outline-none transition focus:border-brass-gold focus:ring-2 focus:ring-brass-gold/30";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setError(null);

    const siteUrl =
      typeof window !== "undefined"
        ? window.location.origin
        : process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.barnbook.us";

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      {
        redirectTo: `${siteUrl}/auth/reset-password`,
      },
    );

    if (resetError) {
      setError(resetError.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-barn-dark px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="font-serif text-3xl font-bold text-parchment">
            BarnBook
          </Link>
        </div>

        <div className="rounded-2xl border border-brass-gold/15 bg-barn-dark/80 p-8 shadow-xl backdrop-blur">
          {sent ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brass-gold/15">
                <svg className="h-8 w-8 text-brass-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              </div>
              <h2 className="font-serif text-xl font-semibold text-parchment">
                Check your email
              </h2>
              <p className="mt-2 text-sm text-muted-tan">
                We sent a password reset link to <strong className="text-parchment">{email}</strong>.
                Click the link in the email to set a new password.
              </p>
              <p className="mt-4 text-xs text-muted-tan/60">
                Didn&apos;t get it? Check your spam folder or{" "}
                <button
                  type="button"
                  onClick={() => { setSent(false); setError(null); }}
                  className="text-brass-gold underline"
                >
                  try again
                </button>.
              </p>
              <Link
                href="/auth/signin"
                className="mt-6 inline-block text-sm text-brass-gold hover:underline"
              >
                &larr; Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <h2 className="mb-2 font-serif text-xl font-semibold text-parchment">
                Reset your password
              </h2>
              <p className="mb-6 text-sm text-muted-tan">
                Enter the email address you used to sign up and we&apos;ll send you a link to reset your password.
              </p>

              {error && (
                <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="mb-1.5 block text-sm text-muted-tan">
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                    placeholder="you@example.com"
                    required
                    autoFocus
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="w-full rounded-xl bg-brass-gold py-3 text-sm font-semibold text-barn-dark transition hover:brightness-110 disabled:opacity-50"
                >
                  {loading ? "Sending..." : "Send reset link"}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-tan">
                Remember your password?{" "}
                <Link href="/auth/signin" className="text-brass-gold hover:underline">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
