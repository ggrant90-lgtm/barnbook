"use client";

import { redeemKeyAction, submitKeyRequestAction } from "@/app/join/actions";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

function errMessage(code: string | undefined): string {
  switch (code) {
    case "invalid_key":
      return "That key doesn’t match any active invite.";
    case "inactive":
      return "This key has been deactivated.";
    case "expired":
      return "This key has expired.";
    case "max_uses":
      return "This key has reached its maximum number of uses.";
    case "already_redeemed":
      return "You’ve already redeemed this key.";
    case "not_signed_in":
      return "Sign in to continue.";
    default:
      return "Couldn’t redeem this key. Try again.";
  }
}

export function JoinForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const [code, setCode] = useState("");
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reqMsg, setReqMsg] = useState<string | null>(null);
  const [reqPending, setReqPending] = useState(false);

  const barnParam = sp.get("barn");
  const kParam = sp.get("k");

  useEffect(() => {
    if (kParam) setCode(kParam);
  }, [kParam]);

  const refreshUser = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    setUserId(data.user?.id ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refreshUser();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void refreshUser();
    });
    return () => sub.subscription.unsubscribe();
  }, [refreshUser]);

  const qs = new URLSearchParams();
  if (kParam) qs.set("k", kParam);
  if (barnParam) qs.set("barn", barnParam);
  const nextJoin = `/join${qs.toString() ? `?${qs.toString()}` : ""}`;

  async function onRedeem(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const res = await redeemKeyAction(code);
    setPending(false);
    if (!res.ok) {
      setError(errMessage(res.error));
      return;
    }
    if (res.redirectTo) {
      router.push(res.redirectTo);
      router.refresh();
    }
  }

  async function onRequestAccess(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!barnParam) return;
    setReqMsg(null);
    setReqPending(true);
    const fd = new FormData(e.currentTarget);
    const r = await submitKeyRequestAction(null, fd);
    setReqPending(false);
    if (r?.error) setReqMsg(r.error);
    else setReqMsg("Request sent. The barn owner will review it.");
  }

  if (loading) {
    return (
      <div className="mx-auto flex min-h-full max-w-lg flex-col px-5 py-12 sm:px-8">
        <p className="text-muted-tan">Loading…</p>
      </div>
    );
  }

  const signedIn = Boolean(userId);

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col px-5 py-12 sm:px-8">
      <h1 className="font-serif text-2xl font-semibold text-parchment">Join with a key</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-tan">
        Enter a Barn Key or Stall Key from your barn manager. Keys look like{" "}
        <span className="font-mono text-parchment/90">BK-XXXX-XXXX</span> or{" "}
        <span className="font-mono text-parchment/90">SK-XXXX-XXXX</span>.
      </p>

      <form onSubmit={onRedeem} className="mt-10 space-y-4">
        <div>
          <label htmlFor="key_code" className="mb-1.5 block text-sm font-medium text-parchment/90">
            Key code
          </label>
          <input
            id="key_code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="off"
            className="w-full rounded-xl border border-brass-gold/25 bg-barn-panel px-4 py-3 font-mono text-sm text-parchment outline-none placeholder:text-muted-tan focus:border-brass-gold focus:ring-2 focus:ring-brass-gold/25"
            placeholder="BK-… or SK-…"
          />
        </div>

        {error ? (
          <p className="rounded-lg border border-barn-red/40 bg-barn-red/10 px-3 py-2 text-sm text-parchment" role="alert">
            {error}
          </p>
        ) : null}

        {signedIn ? (
          <button
            type="submit"
            disabled={pending || !code.trim()}
            className="w-full rounded-xl bg-brass-gold px-5 py-3 font-medium text-barn-dark shadow hover:brightness-110 disabled:opacity-50"
          >
            {pending ? "Redeeming…" : "Redeem key"}
          </button>
        ) : (
          <div className="rounded-xl border border-brass-gold/20 bg-barn-panel/80 p-4">
            <p className="text-sm text-parchment/90">Sign in or create an account to use this key.</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Link
                href={`/auth/signin?next=${encodeURIComponent(nextJoin)}`}
                className="inline-flex flex-1 items-center justify-center rounded-xl bg-brass-gold px-4 py-2.5 text-center text-sm font-medium text-barn-dark hover:brightness-110"
              >
                Sign in
              </Link>
              <Link
                href={`/auth/signup?next=${encodeURIComponent(nextJoin)}`}
                className="inline-flex flex-1 items-center justify-center rounded-xl border border-brass-gold/40 px-4 py-2.5 text-center text-sm font-medium text-parchment hover:bg-barn-panel"
              >
                Create account
              </Link>
            </div>
          </div>
        )}
      </form>

      {signedIn && barnParam ? (
        <section className="mt-12 border-t border-brass-gold/15 pt-10">
          <h2 className="font-serif text-lg text-parchment">Request access</h2>
          <p className="mt-2 text-sm text-muted-tan">
            No key? Send a request to this barn. A manager can approve you from the Keys dashboard.
          </p>
          <form onSubmit={onRequestAccess} className="mt-4 space-y-3">
            <input type="hidden" name="barn_id" value={barnParam} />
            <div>
              <label htmlFor="desired_role" className="mb-1 block text-xs text-muted-tan">
                Requested role
              </label>
              <select
                id="desired_role"
                name="desired_role"
                className="w-full rounded-xl border border-brass-gold/25 bg-barn-panel px-3 py-2 text-sm text-parchment"
                defaultValue="viewer"
              >
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
                <option value="manager">Manager</option>
              </select>
            </div>
            <div>
              <label htmlFor="message" className="mb-1 block text-xs text-muted-tan">
                Message (optional)
              </label>
              <textarea
                id="message"
                name="message"
                rows={3}
                className="w-full rounded-xl border border-brass-gold/25 bg-barn-panel px-3 py-2 text-sm text-parchment outline-none focus:border-brass-gold"
                placeholder="Who you are, how you work with the barn…"
              />
            </div>
            {reqMsg ? (
              <p className="text-sm text-brass-gold/90" role="status">
                {reqMsg}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={reqPending}
              className="rounded-xl border border-brass-gold/40 px-4 py-2.5 text-sm font-medium text-parchment hover:bg-barn-panel disabled:opacity-50"
            >
              {reqPending ? "Sending…" : "Send request"}
            </button>
          </form>
        </section>
      ) : null}

      <p className="mt-12 text-center text-xs text-muted-tan">
        <Link href="/" className="hover:text-brass-gold">
          Back to home
        </Link>
      </p>
    </div>
  );
}
