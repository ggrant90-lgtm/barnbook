"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { linkHorseToServiceBarnAction } from "@/app/(protected)/actions/service-barn-links";

/**
 * Shown at the top of a horse profile right after a Stall Key is
 * redeemed, if the current user owns a Service Barn. Clicking "Add"
 * links the horse into the Service Barn; "Not now" dismisses (in
 * sessionStorage so it doesn't reappear this tab).
 */
export function AutoLinkBanner({
  horseId,
  horseName,
  serviceBarnId,
  serviceBarnName,
}: {
  horseId: string;
  horseName: string;
  serviceBarnId: string;
  serviceBarnName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<
    "visible" | "dismissed" | "linked" | "error"
  >(() => {
    if (typeof window === "undefined") return "visible";
    try {
      const key = `barnbook:autolink-dismissed:${serviceBarnId}:${horseId}`;
      if (sessionStorage.getItem(key) === "1") return "dismissed";
    } catch {
      /* ignore */
    }
    return "visible";
  });
  const [error, setError] = useState<string | null>(null);

  if (state === "dismissed" || state === "linked") return null;

  function handleAdd() {
    setError(null);
    startTransition(async () => {
      const res = await linkHorseToServiceBarnAction({
        serviceBarnId,
        horseId,
      });
      if (res.error) {
        setError(res.error);
        setState("error");
        return;
      }
      setState("linked");
      router.refresh();
    });
  }

  function handleDismiss() {
    try {
      sessionStorage.setItem(
        `barnbook:autolink-dismissed:${serviceBarnId}:${horseId}`,
        "1",
      );
    } catch {
      /* ignore */
    }
    setState("dismissed");
    // Strip the querystring so the banner doesn't reappear on reload.
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("linkPrompt");
      window.history.replaceState(null, "", url.toString());
    }
  }

  return (
    <div
      className="mb-4 rounded-xl border px-4 py-3 text-sm"
      style={{
        borderColor: "rgba(75,100,121,0.4)",
        background: "rgba(75,100,121,0.08)",
        color: "#2a4031",
      }}
    >
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="font-medium">
            Add {horseName} to {serviceBarnName}?
          </div>
          <div className="mt-0.5 text-xs" style={{ color: "rgba(42,64,49,0.65)" }}>
            Links this horse into your Service Barn so it shows up with your
            quick records. Your Stall Key access stays the same either way.
          </div>
          {error && (
            <div className="mt-1 text-xs" style={{ color: "#b8421f" }}>
              {error}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleDismiss}
            disabled={pending}
            className="rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-50"
            style={{
              borderColor: "rgba(42,64,49,0.15)",
              background: "white",
              color: "#2a4031",
            }}
          >
            Not now
          </button>
          <button
            type="button"
            onClick={handleAdd}
            disabled={pending}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold shadow disabled:opacity-60"
            style={{ background: "#4b6479", color: "white" }}
          >
            {pending ? "Adding…" : `Add to ${serviceBarnName}`}
          </button>
        </div>
      </div>
    </div>
  );
}
