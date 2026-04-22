"use client";

import { useState } from "react";
import { QuickLogForm, type QuickLogHorseOption } from "./QuickLogForm";

/**
 * Bottom-right fixed "+ Log" button on the Service Barn dashboard.
 *
 * Tap → opens QuickLogForm (the streamlined 10-seconds-from-tap-to-save
 * entry form the spec calls out). The button is thumb-reachable on
 * mobile and sits above the mobile bottom nav via z-index.
 */
interface BarnClientOption {
  id: string;
  display_name: string;
  user_id: string | null;
  name_key: string;
}

export function QuickLogFab({
  serviceBarnId,
  horseOptions,
  hasBusinessPro,
  barnClients,
  currentUserId,
}: {
  serviceBarnId: string;
  horseOptions: QuickLogHorseOption[];
  hasBusinessPro: boolean;
  barnClients: BarnClientOption[];
  currentUserId: string;
}) {
  const [open, setOpen] = useState(false);

  if (horseOptions.length === 0) {
    // No horses in the Service Barn yet → no FAB.
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Quick log entry"
        style={{
          position: "fixed",
          right: "max(16px, env(safe-area-inset-right))",
          bottom: "calc(max(16px, env(safe-area-inset-bottom)) + 72px)",
          width: 56,
          height: 56,
          borderRadius: 28,
          background: "#c9a84c",
          color: "#2a4031",
          boxShadow: "0 4px 12px rgba(0,0,0,0.18)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 45,
          border: "none",
          cursor: "pointer",
        }}
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      </button>

      {open && (
        <QuickLogForm
          serviceBarnId={serviceBarnId}
          horseOptions={horseOptions}
          hasBusinessPro={hasBusinessPro}
          barnClients={barnClients}
          currentUserId={currentUserId}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
