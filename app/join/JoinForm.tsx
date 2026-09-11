"use client";

import { redeemKeyAction, submitKeyRequestAction } from "@/app/join/actions";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

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
  const [confirmation, setConfirmation] = useState<{
    name: string | null;
    redirectTo: string;
  } | null>(null);
  const autoAttempted = useRef(false);

  const barnParam = sp.get("barn");
  const kParam = sp.get("k") || sp.get("key");
  const intentParam = sp.get("intent");
  const horseParam = sp.get("horse");

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
  if (kParam) qs.set("key", kParam);
  else if (code.trim()) qs.set("key", code.trim());
  if (barnParam) qs.set("barn", barnParam);
  if (intentParam) qs.set("intent", intentParam);
  if (horseParam) qs.set("horse", horseParam);
  const nextJoin = `/join${qs.toString() ? `?${qs.toString()}` : ""}`;

  // Auto-redeem: the moment we know the user is signed in and a key is
  // present in the URL, redeem it immediately — no manual "click redeem"
  // step required. Covers both a bare invite link and the post-signup
  // return trip (via the `next` param round-trip through email confirm).
  useEffect(() => {
    if (!userId || !kParam || autoAttempted.current) return;
    autoAttempted.current = true;
    setPending(true);
    void (async () => {
      const res = await redeemKeyAction(kParam);
      setPending(false);

      if (!res.ok && res.error !== "already_redeemed") {
        setError(errMessage(res.error));
        return;
      }

      // "Add a log" intent from the no-account viewer: skip the generic
      // confirmation and drop straight into the log-entry flow.
      if (intentParam === "log" && horseParam) {
        router.push(`/horses/${horseParam}?tab=logs`);
        router.refresh();
        return;
      }

      const redirectTo = res.redirectTo ?? "/dashboard";
      let name: string | null = null;
      try {
        if (horseParam) {
          const { data } = await supabase
            .from("horses")
            .select("name, barn_name, primary_name_pref")
            .eq("id", horseParam)
            .maybeSingle();
          if (data) {
            name =
              data.primary_name_pref === "barn" && data.barn_name
                ? data.barn_name
                : data.name;
          }
        } else if (barnParam) {
          const { data } = await supabase
            .from("barns")
            .select("name")
            .eq("id", barnParam)
            .maybeSingle();
          name = data?.name ?? null;
        }
      } catch {
        /* best-effort — confirmation still shows without a name */
      }

      setConfirmation({ name, redirectTo });
      router.refresh();
    })();
  }, [userId, kParam, intentParam, horseParam, barnParam, router]);

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

  if (confirmation) {
    return (
      <div className="mx-auto flex min-h-full max-w-lg flex-col px-5 py-12 sm:px-8">
        <div className="rounded-2xl border border-brass-gold/25 bg-barn-panel p-8 text-center shadow-lg shadow-black/40">
          <p className="font-serif text-2xl text-brass-gold">You&apos;re in!</p>
          <p className="mt-3 text-parchment">
            {confirmation.name ? `${confirmation.name} has been added.` : "Access has been added."}
          </p>
          <Link
            href={confirmation.redirectTo}
            className="mt-8 inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-brass-gold px-4 py-3.5 text-center font-medium text-barn-dark transition hover:brightness-110"
          >
            Continue
          </Link>
        </div>
      </div>
    );
  }

  // Signed in with a key already in the URL — auto-redeem is in flight
  // (or about to be); show a lightweight status instead of the manual form.
  if (signedIn && kParam && !error) {
    return (
      <div className="mx-auto flex min-h-full max-w-lg flex-col px-5 py-12 sm:px-8">
        <p className="text-center text-muted-tan">Redeeming your key…</p>
      </div>
    );
  }

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
