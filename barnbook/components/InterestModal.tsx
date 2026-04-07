"use client";

import { useState, useEffect } from "react";

export default function InterestModal({
  isOpen,
  onClose,
  planName,
  planKey,
}: {
  isOpen: boolean;
  onClose: () => void;
  planName: string;
  planKey: string;
}) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setEmail("");
      setMessage("");
      setSubmitted(false);
      setError("");
    }
  }, [isOpen]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/capture-interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          message: message.trim() || null,
          plan_requested: planKey,
        }),
      });

      if (!res.ok) throw new Error("Failed to submit");
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setSubmitting(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40" />

      {/* Modal */}
      <div
        className="relative z-10 w-full max-w-md rounded-2xl p-8 shadow-xl"
        style={{ background: "var(--cream-warm)", border: "2px solid #c9a84c" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 transition-colors cursor-pointer"
          style={{ color: "var(--ink-soft)" }}
        >
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {submitted ? (
          <div className="text-center py-4">
            <div
              className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
              style={{ background: "rgba(42, 64, 49, 0.12)" }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--forest)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2
              className="font-serif text-xl mb-2"
              style={{ color: "var(--ink)", letterSpacing: "-0.01em" }}
            >
              Thanks! You&apos;re on the list.
            </h2>
            <p className="text-sm mb-6" style={{ color: "var(--ink-soft)" }}>
              We&apos;ll reach out personally when {planName} is ready.
              In the meantime, enjoy free access to everything.
            </p>
            <button
              onClick={onClose}
              className="rounded-full px-6 py-3 font-medium text-sm cursor-pointer transition-all hover:-translate-y-px"
              style={{ background: "var(--forest)", color: "var(--cream)" }}
            >
              Got it
            </button>
          </div>
        ) : (
          <>
            <h2
              className="font-serif text-xl mb-2 pr-8"
              style={{ color: "var(--ink)", letterSpacing: "-0.01em" }}
            >
              Get on the list for {planName}
            </h2>
            <p className="text-sm mb-6" style={{ color: "var(--ink-soft)" }}>
              Drop your email and we&apos;ll notify you when this plan goes live.
              Everything is free until then.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  className="block text-sm font-medium mb-1.5"
                  style={{ color: "var(--ink-soft)" }}
                >
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-colors"
                  style={{
                    background: "var(--cream)",
                    border: "1px solid var(--line-strong)",
                    color: "var(--ink)",
                  }}
                />
              </div>
              <div>
                <label
                  className="block text-sm font-medium mb-1.5"
                  style={{ color: "var(--ink-soft)" }}
                >
                  Anything you want us to know? (optional)
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-colors resize-none"
                  style={{
                    background: "var(--cream)",
                    border: "1px solid var(--line-strong)",
                    color: "var(--ink)",
                  }}
                />
              </div>

              {error && (
                <p className="text-sm" style={{ color: "var(--rust)" }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={!email.trim() || submitting}
                className="w-full rounded-full py-3 font-medium text-sm cursor-pointer transition-all hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: "#c9a84c", color: "var(--ink)" }}
              >
                {submitting ? "Submitting..." : "Notify me when it's ready"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
