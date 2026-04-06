"use client";

import { STALL_BLOCK_SIZES } from "@/lib/plans";
import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

export function UpgradeModal({
  barnName,
  barnId,
  currentCapacity,
  isAddition,
  onClose,
}: {
  barnName: string;
  barnId: string;
  currentCapacity: number;
  isAddition?: boolean;
  onClose: () => void;
}) {
  const [step, setStep] = useState<"choose" | "interest">("choose");
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleChoosePlan = (planId: string) => {
    setSelectedPlan(planId);
    setStep("interest");
  };

  const handleSubmitInterest = async () => {
    if (!email.trim()) return;
    setSubmitting(true);

    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );

      const {
        data: { user },
      } = await supabase.auth.getUser();

      await supabase.from("paywall_interest").insert({
        user_id: user?.id ?? null,
        barn_id: barnId,
        plan_requested: selectedPlan ?? "unknown",
        email: email.trim(),
        message: message.trim() || null,
      });

      setSubmitted(true);
    } catch {
      // Fail silently — don't block the user
      setSubmitted(true);
    }
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
        <div className="fixed inset-0 bg-black/40" />
        <div
          className="relative z-10 w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
            <span className="text-2xl">✓</span>
          </div>
          <h2 className="font-serif text-xl font-semibold text-barn-dark">
            You&apos;re on the list!
          </h2>
          <p className="mt-2 text-sm text-barn-dark/70">
            We&apos;ll reach out personally when paid plans are ready. In the
            meantime, enjoy unlimited access — it&apos;s on us.
          </p>
          <button
            onClick={onClose}
            className="mt-6 rounded-xl bg-brass-gold px-6 py-3 font-medium text-barn-dark shadow hover:brightness-110"
          >
            Back to barn
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="fixed inset-0 bg-black/40" />
      <div
        className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-barn-dark/40 hover:bg-barn-dark/5"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {step === "choose" ? (
          <>
            <h2 className="font-serif text-2xl font-semibold text-barn-dark">
              {isAddition ? "Add a Wing" : "Upgrade Your Barn"}
            </h2>
            <p className="mt-2 text-sm text-barn-dark/70">
              {isAddition
                ? `${barnName} is at its ${currentCapacity}-stall limit. Add another wing to keep growing.`
                : `${barnName} is at its ${currentCapacity}-stall limit. Pick a plan to add more horses.`}
            </p>

            <div className="mt-6 grid grid-cols-2 gap-4">
              {STALL_BLOCK_SIZES.map((block) => (
                <button
                  key={block.size}
                  onClick={() =>
                    handleChoosePlan(
                      isAddition
                        ? `${block.size}_stall_addition`
                        : `${block.size}_stall`,
                    )
                  }
                  className="group rounded-xl border-2 border-barn-dark/10 bg-parchment/30 p-5 text-left transition hover:border-brass-gold hover:shadow-md"
                >
                  <div className="text-2xl font-bold text-barn-dark">
                    {block.size}
                  </div>
                  <div className="text-sm text-barn-dark/60">stalls</div>
                  <div className="mt-3 text-lg font-semibold text-brass-gold">
                    {block.priceLabel}
                  </div>
                  <div className="mt-3 rounded-lg bg-brass-gold/10 px-3 py-2 text-center text-xs font-medium text-brass-gold group-hover:bg-brass-gold group-hover:text-white transition">
                    Choose this plan
                  </div>
                </button>
              ))}
            </div>

            <p className="mt-4 text-center text-xs text-barn-dark/40">
              All plans include every BarnBook feature. No limits except stall count.
            </p>
          </>
        ) : (
          <>
            <h2 className="font-serif text-xl font-semibold text-barn-dark">
              Almost there!
            </h2>
            <p className="mt-2 text-sm text-barn-dark/70">
              We&apos;re rolling out paid plans soon. Drop your email and
              we&apos;ll reach out personally when the{" "}
              {selectedPlan?.replace(/_/g, " ")} plan is ready.
            </p>
            <p className="mt-2 text-sm font-medium text-green-700 bg-green-50 rounded-lg px-3 py-2">
              In the meantime, enjoy unlimited access — no charge.
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-sm text-barn-dark/75">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-barn-dark/15 bg-white px-4 py-3 text-barn-dark outline-none focus:border-brass-gold focus:ring-2 focus:ring-brass-gold/25"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-barn-dark/75">
                  Anything you want us to know? (optional)
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-barn-dark/15 bg-white px-4 py-3 text-barn-dark outline-none focus:border-brass-gold focus:ring-2 focus:ring-brass-gold/25"
                />
              </div>
              <button
                onClick={handleSubmitInterest}
                disabled={!email.trim() || submitting}
                className="w-full rounded-xl bg-brass-gold px-4 py-3 font-medium text-barn-dark shadow hover:brightness-110 disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Notify me when it's ready"}
              </button>
              <button
                onClick={() => setStep("choose")}
                className="w-full text-center text-sm text-barn-dark/50 hover:text-barn-dark"
              >
                ← Back to plans
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
