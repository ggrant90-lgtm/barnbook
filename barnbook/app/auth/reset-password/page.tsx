"use client";

import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

const inputClass =
  "w-full rounded-xl border border-brass-gold/25 bg-barn-dark px-4 py-3 text-parchment placeholder:text-muted-tan/60 outline-none transition focus:border-brass-gold focus:ring-2 focus:ring-brass-gold/30";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Supabase handles the token exchange automatically when the user
  // clicks the reset link — the session is set via the URL hash fragment.
  // We just need to wait for the auth state to be ready.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === "PASSWORD_RECOVERY") {
          setReady(true);
        }
      },
    );

    // Also check if we already have a session (user may have landed here
    // with a valid recovery session already established)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError(null);

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);

    // Redirect to dashboard after a moment
    setTimeout(() => router.push("/dashboard"), 2000);
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
          {success ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/15">
                <svg className="h-8 w-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="font-serif text-xl font-semibold text-parchment">
                Password updated!
              </h2>
              <p className="mt-2 text-sm text-muted-tan">
                Redirecting you to your dashboard...
              </p>
            </div>
          ) : !ready ? (
            <div className="text-center">
              <h2 className="font-serif text-xl font-semibold text-parchment mb-2">
                Loading...
              </h2>
              <p className="text-sm text-muted-tan">
                Verifying your reset link. If this takes too long,{" "}
                <Link href="/auth/forgot-password" className="text-brass-gold underline">
                  request a new one
                </Link>.
              </p>
            </div>
          ) : (
            <>
              <h2 className="mb-2 font-serif text-xl font-semibold text-parchment">
                Set a new password
              </h2>
              <p className="mb-6 text-sm text-muted-tan">
                Enter your new password below. Must be at least 6 characters.
              </p>

              {error && (
                <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="password" className="mb-1.5 block text-sm text-muted-tan">
                    New password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputClass}
                    placeholder="At least 6 characters"
                    required
                    minLength={6}
                    autoFocus
                  />
                </div>

                <div>
                  <label htmlFor="confirm" className="mb-1.5 block text-sm text-muted-tan">
                    Confirm new password
                  </label>
                  <input
                    id="confirm"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={inputClass}
                    placeholder="Type it again"
                    required
                    minLength={6}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !password || !confirmPassword}
                  className="w-full rounded-xl bg-brass-gold py-3 text-sm font-semibold text-barn-dark transition hover:brightness-110 disabled:opacity-50"
                >
                  {loading ? "Updating..." : "Update password"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
