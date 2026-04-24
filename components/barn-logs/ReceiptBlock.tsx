"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  getReceiptSignedUrlAction,
  clearReceiptAction,
} from "@/app/(protected)/actions/receipts";

/**
 * BP-only display surface for a receipt attached to a barn log.
 *
 * Renders nothing for non-BP users even when a receipt is present —
 * the data persists, the UI is gated. If a non-BP user upgrades, the
 * block appears automatically on their existing rows.
 *
 * Fetches a short-lived signed URL lazily on mount so a stale
 * session with an expired URL doesn't matter. Thumbnail clicks open
 * the full image in a new tab; a separate "Remove receipt" button
 * clears the DB columns (the storage object is left orphaned — the
 * database is authoritative).
 */
export function ReceiptBlock({
  barnLogId,
  hasBusinessPro,
  fileName,
}: {
  barnLogId: string;
  hasBusinessPro: boolean;
  fileName?: string | null;
}) {
  const router = useRouter();
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [removing, startRemoveTransition] = useTransition();
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  useEffect(() => {
    if (!hasBusinessPro) return;
    let cancelled = false;
    (async () => {
      const res = await getReceiptSignedUrlAction(barnLogId);
      if (cancelled) return;
      if (res.signedUrl) setUrl(res.signedUrl);
      else if (res.error) setErr(res.error);
    })();
    return () => {
      cancelled = true;
    };
  }, [barnLogId, hasBusinessPro]);

  if (!hasBusinessPro) return null;

  function handleRemove() {
    setErr(null);
    startRemoveTransition(async () => {
      const res = await clearReceiptAction(barnLogId);
      if (res.error) {
        setErr(res.error);
        return;
      }
      setConfirmingRemove(false);
      router.refresh();
    });
  }

  return (
    <div
      className="rounded-xl border bg-white p-3"
      style={{ borderColor: "rgba(42,64,49,0.1)" }}
    >
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-barn-dark/55">
        Receipt
      </div>
      <div className="flex items-start gap-3">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={fileName ?? "Receipt"}
            className="h-24 w-24 rounded-md object-cover border"
            style={{ borderColor: "rgba(42,64,49,0.12)" }}
          />
        ) : (
          <div
            className="h-24 w-24 rounded-md border flex items-center justify-center text-xs text-barn-dark/45"
            style={{ borderColor: "rgba(42,64,49,0.12)" }}
          >
            Loading…
          </div>
        )}
        <div className="flex-1 min-w-0">
          {fileName && (
            <div className="truncate text-xs text-barn-dark/65">
              {fileName}
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border px-3 py-1 text-xs font-medium text-barn-dark hover:bg-parchment"
                style={{ borderColor: "rgba(42,64,49,0.15)" }}
              >
                Open full size
              </a>
            )}
            {confirmingRemove ? (
              <>
                <span className="text-xs text-barn-dark/60">
                  Remove receipt?
                </span>
                <button
                  type="button"
                  onClick={handleRemove}
                  disabled={removing}
                  className="rounded-lg bg-red-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
                >
                  {removing ? "Removing…" : "Yes"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingRemove(false)}
                  disabled={removing}
                  className="rounded-lg border px-3 py-1 text-xs text-barn-dark/70"
                  style={{ borderColor: "rgba(42,64,49,0.15)" }}
                >
                  No
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingRemove(true)}
                className="text-xs text-red-500/70 hover:text-red-600"
              >
                Remove receipt
              </button>
            )}
          </div>
          {err && (
            <div className="mt-1 text-[11px]" style={{ color: "#b8421f" }}>
              {err}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
