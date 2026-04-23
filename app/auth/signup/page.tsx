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
  if (m.includes("already registered") || m.includes("already been registered"))
    return "That email is already registered. Try signing in.";
  if (m.includes("password") && m.includes("6"))
    return "Password must be at least 6 characters.";
  if (m.includes("invalid email")) return "Enter a valid email address.";
  return message;
}

function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextParam(searchParams.get("next"));

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consentError, setConsentError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const name = fullName.trim();
    if (!name) {
      setError("Please enter your full name.");
      return;
    }
    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!agreedToTerms) {
      setConsentError(true);
      setError("You must agree to the Terms of Service and Privacy Policy.");
      return;
    }
    setConsentError(false);

    setLoading(true);
    const origin = window.location.origin;
    // Pass the `next` destination through the email callback so the key is preserved
    const callbackUrl = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: callbackUrl,
      },
    });
    setLoading(false);

    if (signUpError) {
      setError(mapAuthError(signUpError.message));
      return;
    }

    // Record consent (non-blocking — don't fail signup if this fails)
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (userId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from("user_consents").insert({
          user_id: userId,
          terms_version: "2026-04-06",
          privacy_version: "2026-04-06",
          user_agent: navigator.userAgent,
        });
      }
    } catch (err) {
      console.error("Failed to record consent:", err);
    }

    setSuccess(true);
    router.refresh();
  }

  // Build sign-in link preserving the next param
  const signInHref = next !== "/dashboard"
    ? `/auth/signin?next=${encodeURIComponent(next)}`
    : "/auth/signin";

  if (success) {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-5 py-12 sm:px-8">
        <div className="rounded-2xl border border-brass-gold/25 bg-barn-panel p-8 shadow-lg shadow-black/40">
          <p className="font-serif text-xl text-brass-gold">Almost there</p>
          <p className="mt-4 text-parchment">
            Check your email to confirm your account.
          </p>
          <p className="mt-3 text-sm text-muted-tan">
            After you confirm, you can sign in and{" "}
            {next.startsWith("/join") ? "redeem your key" : "go straight to your dashboard"}.
          </p>
          <Link
            href={signInHref}
            className="mt-8 inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-brass-gold px-4 py-3.5 text-center font-medium text-barn-dark transition hover:brightness-110"
          >
            Go to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-5 py-12 sm:px-8">
      <div className="mb-8 text-center">
        <p className="font-serif text-3xl text-parchment">BarnBook</p>
        <h1 className="mt-2 text-lg text-muted-tan">Create your account</h1>
      </div>

      <form
        onSubmit={onSubmit}
        className="rounded-2xl border border-brass-gold/20 bg-barn-panel p-6 shadow-lg shadow-black/40 sm:p-8"
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="fullName" className="mb-1.5 block text-sm text-muted-tan">
              Full name
            </label>
            <input
              id="fullName"
              name="fullName"
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={inputClass}
              required
            />
          </div>
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
            <label htmlFor="password" className="mb-1.5 block text-sm text-muted-tan">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              required
              minLength={6}
            />
          </div>
          <div>
            <label htmlFor="confirm" className="mb-1.5 block text-sm text-muted-tan">
              Confirm password
            </label>
            <input
              id="confirm"
              name="confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={inputClass}
              required
              minLength={6}
            />
          </div>
        </div>

        {/* Terms consent checkbox */}
        <div className="mt-5">
          <label
            htmlFor="consent"
            className="flex items-start gap-3 cursor-pointer"
          >
            <input
              id="consent"
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => {
                setAgreedToTerms(e.target.checked);
                if (e.target.checked) setConsentError(false);
              }}
              aria-describedby={consentError ? "consent-error" : undefined}
              className="mt-1 h-4 w-4 shrink-0 rounded border-brass-gold/40 bg-barn-dark text-brass-gold accent-brass-gold focus:ring-2 focus:ring-brass-gold/30"
            />
            <span className="text-sm text-muted-tan leading-relaxed">
              I agree to the{" "}
              <a
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-brass-gold underline-offset-2 hover:underline"
              >
                Terms of Service
              </a>{" "}
              and{" "}
              <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-brass-gold underline-offset-2 hover:underline"
              >
                Privacy Policy
              </a>
            </span>
          </label>
          {consentError && (
            <p
              id="consent-error"
              className="mt-1.5 ml-7 text-xs text-barn-red"
              role="alert"
            >
              You must agree to continue
            </p>
          )}
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
          disabled={loading || !agreedToTerms}
          className="mt-6 flex min-h-[48px] w-full items-center justify-center rounded-xl bg-brass-gold px-4 py-3.5 font-medium text-barn-dark shadow-md transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Creating account…" : "Sign up"}
        </button>

        <p className="mt-6 text-center text-sm text-muted-tan">
          Already have an account?{" "}
          <Link href={signInHref} className="font-medium text-brass-gold underline-offset-2 hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-full items-center justify-center px-5 py-16 text-muted-tan">
          Loading…
        </div>
      }
    >
      <SignUpForm />
    </Suspense>
  );
}
