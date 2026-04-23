"use client";

import { useEffect, useRef, useState } from "react";
import { getHorseDocumentSignedUrlAction } from "@/app/(protected)/actions/horse-documents";
import { ErrorDetails } from "@/components/ui/ErrorDetails";

/**
 * In-app document viewer modal.
 *
 * Fetches a signed URL for the document and renders it inline:
 *   - image/* → <img>
 *   - application/pdf → <iframe>
 *   - anything else → a "Download to view" link
 *
 * Keeps the user inside BarnBook instead of hopping to a separate tab
 * (which on mobile/PWA was opening a blank tab, then pushing the user
 * out of the app scope — terrible UX).
 */
/**
 * Parent is expected to conditionally render this component (mount on
 * open, unmount on close) so state resets cleanly without needing an
 * effect to clear it.
 */
export function DocumentViewer({
  onClose,
  docId,
  title,
  fileName,
  mimeType,
}: {
  onClose: () => void;
  docId: string;
  title: string;
  fileName: string;
  mimeType: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const reqIdRef = useRef(0);

  useEffect(() => {
    const reqId = ++reqIdRef.current;
    (async () => {
      const res = await getHorseDocumentSignedUrlAction(docId);
      // Ignore stale responses if docId changes or component unmounts quickly.
      if (reqId !== reqIdRef.current) return;
      setLoading(false);
      if (res.error || !res.url) {
        setError(res.error ?? "Unknown error");
        return;
      }
      setUrl(res.url);
    })();
  }, [docId]);

  // Close on Escape for desktop keyboard users.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isImage = mimeType.startsWith("image/");
  const isPdf = mimeType === "application/pdf";

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(42,64,49,0.85)",
        zIndex: 100,
        display: "flex",
        alignItems: "stretch",
        justifyContent: "center",
        padding: "env(safe-area-inset-top) 0 env(safe-area-inset-bottom)",
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`View document: ${title}`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="sm:my-8 sm:max-h-[92vh] sm:rounded-2xl"
        style={{
          background: "white",
          width: "100%",
          maxWidth: 960,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          borderRadius: 0,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderBottom: "1px solid rgba(0,0,0,0.08)",
            gap: 12,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              className="font-serif text-base font-semibold text-barn-dark"
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {title}
            </div>
            <div
              className="text-xs text-barn-dark/60 mt-0.5"
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {fileName}
            </div>
          </div>
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded-lg border border-barn-dark/15 bg-white px-3 py-1.5 text-xs font-medium text-barn-dark hover:bg-parchment"
            >
              Open in new tab
            </a>
          )}
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-barn-dark/60 hover:bg-parchment"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            flex: 1,
            overflow: "auto",
            background: isImage ? "#0b0f0c" : "#f5f2ea",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: isImage ? 0 : 16,
          }}
        >
          {loading && (
            <div className="text-sm text-barn-dark/60">Loading document…</div>
          )}
          {error && (
            <div style={{ width: "100%", maxWidth: 600 }}>
              <ErrorDetails
                title="Couldn't load document"
                message={error}
                extra={{ "Document ID": docId, "MIME type": mimeType }}
              />
            </div>
          )}
          {url && !error && (
            <>
              {isImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={url}
                  alt={title}
                  style={{
                    maxWidth: "100%",
                    maxHeight: "100%",
                    objectFit: "contain",
                    display: "block",
                  }}
                />
              )}
              {isPdf && (
                <iframe
                  src={url}
                  title={title}
                  style={{
                    width: "100%",
                    height: "100%",
                    minHeight: "70vh",
                    border: 0,
                    background: "white",
                  }}
                />
              )}
              {!isImage && !isPdf && (
                <div className="text-center text-sm text-barn-dark/70">
                  Preview not supported for this file type.
                  <div className="mt-3">
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center rounded-lg bg-brass-gold px-4 py-2 text-sm font-semibold text-barn-dark hover:brightness-110"
                    >
                      Open in new tab
                    </a>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
