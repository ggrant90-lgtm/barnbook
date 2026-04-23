"use client";

import { ErrorDetails } from "@/components/ui/ErrorDetails";

/**
 * Root-level error boundary. Next.js renders this when an error escapes
 * every nested error.tsx (including the layout itself). Must include its
 * own <html>/<body> because the root layout has already failed at this
 * point.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div style={{ maxWidth: 640, margin: "40px auto", padding: "0 16px" }}>
          <ErrorDetails
            title="Something went wrong"
            message={error.message || "Unknown error"}
            extra={{
              Name: error.name,
              Digest: error.digest,
              Stack: error.stack,
            }}
          />
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 16,
              minHeight: 44,
              padding: "8px 16px",
              border: "1px solid #ccc",
              borderRadius: 8,
              background: "#fff",
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
