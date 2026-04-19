"use client";

import { ErrorDetails } from "@/components/ui/ErrorDetails";

/**
 * Route segment error boundary for the protected app tree.
 * Next.js catches any thrown error in this segment's render or server
 * components and renders this component with the error instance.
 *
 * We surface the full message + digest so the user can copy it back to
 * us for debugging — much more useful than a generic "Something went
 * wrong" page.
 */
export default function ProtectedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-xl px-4 py-10">
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
        className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-lg border border-barn-dark/20 bg-white px-4 py-2 text-sm font-medium text-barn-dark hover:bg-parchment"
      >
        Try again
      </button>
    </div>
  );
}
