"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  MODULE_LABEL,
  MODULE_PRICE_LABEL,
  type ModuleId,
} from "@/lib/modules-query";
import { subscribeToModuleAction } from "@/lib/modules";
import { ErrorDetails } from "@/components/ui/ErrorDetails";

/**
 * Simple subscribe-confirmation modal. No payment processor yet — this
 * writes to module_subscriptions and flips the profile flag back on.
 */
export function SubscribeModal(props: {
  open: boolean;
  onClose: () => void;
  module: ModuleId;
}) {
  if (!props.open) return null;
  // Conditional mount so local state resets each open (no setState-in-effect).
  return <SubscribeModalInner {...props} />;
}

function SubscribeModalInner({
  onClose,
  module,
}: {
  onClose: () => void;
  module: ModuleId;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function onConfirm() {
    setError(null);
    startTransition(async () => {
      const res = await subscribeToModuleAction(module);
      if (res.error) {
        setError(res.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        background: "rgba(42,64,49,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="rounded-2xl bg-white"
        style={{ width: "100%", maxWidth: 440, padding: 24 }}
      >
        <h2
          className="font-serif text-xl font-semibold"
          style={{ color: "#2a4031" }}
        >
          Subscribe to {MODULE_LABEL[module]}
        </h2>
        <p className="mt-2 text-sm" style={{ color: "rgba(42,64,49,0.7)" }}>
          Keep full access to {MODULE_LABEL[module]} for{" "}
          <strong>{MODULE_PRICE_LABEL[module]}</strong>. You won&apos;t be
          charged today — we&apos;ll email you before billing begins.
        </p>
        {error && (
          <div className="mt-3">
            <ErrorDetails
              title="Couldn't subscribe"
              message={error}
              extra={{ Module: module }}
            />
          </div>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="min-h-[44px] rounded-xl border px-4 py-2 text-sm font-medium"
            style={{
              borderColor: "rgba(42,64,49,0.15)",
              color: "#2a4031",
              background: "white",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="min-h-[44px] rounded-xl px-5 py-2 text-sm font-semibold shadow disabled:opacity-60"
            style={{ background: "#0f6e56", color: "white" }}
          >
            {pending ? "Subscribing…" : `Subscribe — ${MODULE_PRICE_LABEL[module]}`}
          </button>
        </div>
      </div>
    </div>
  );
}
