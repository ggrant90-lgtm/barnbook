"use client";

import { useState } from "react";

/**
 * Mobile-friendly verbose error display with a big Copy button.
 *
 * Used by the route-level error boundaries, the ScanModal error stage,
 * and anywhere else we want the user to be able to paste a raw error
 * into a chat with us for debugging.
 *
 * Displays the raw message + optional name/digest/stack in a pre-wrapped
 * block so long Supabase error strings are visible without truncation.
 */
export function ErrorDetails({
  title = "Something went wrong",
  message,
  extra,
  className,
}: {
  title?: string;
  message: string;
  /** Optional extra lines to include in the copy payload (e.g. digest, stack). */
  extra?: Record<string, string | undefined>;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const payload = [
    `Title: ${title}`,
    `Message: ${message}`,
    ...Object.entries(extra ?? {})
      .filter(([, v]) => v !== undefined && v !== "")
      .map(([k, v]) => `${k}: ${v}`),
    `Where: ${typeof window !== "undefined" ? window.location.href : ""}`,
    `When: ${new Date().toISOString()}`,
    `UA: ${typeof navigator !== "undefined" ? navigator.userAgent : ""}`,
  ].join("\n");

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Some mobile browsers block clipboard writes without a permission
      // prompt — fall back to selecting the <pre> so the user can long-press
      // to copy manually.
      const el = document.getElementById("error-details-payload");
      if (el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }
  }

  return (
    <div
      className={
        "rounded-xl border border-barn-red/40 bg-barn-red/5 p-4 text-sm text-barn-dark " +
        (className ?? "")
      }
      role="alert"
    >
      <div className="mb-2 font-semibold">{title}</div>
      <pre
        id="error-details-payload"
        className="max-h-[40vh] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-white/60 p-3 font-mono text-xs text-barn-dark/90"
        // User-selectable so long-press to copy works even when the Copy
        // button is blocked by mobile clipboard permissions.
        style={{ userSelect: "text" }}
      >
        {payload}
      </pre>
      <button
        type="button"
        onClick={onCopy}
        className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-lg bg-brass-gold px-4 py-2 text-sm font-semibold text-barn-dark hover:brightness-110"
      >
        {copied ? "Copied" : "Copy error"}
      </button>
    </div>
  );
}
