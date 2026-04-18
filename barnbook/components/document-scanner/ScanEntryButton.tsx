"use client";

import { useState } from "react";
import { ScanModal, type ScanMode, type ScanResult } from "./ScanModal";

/**
 * Small shared entry point that opens the ScanModal. Used from the horse
 * profile Documents tab, the /horses/new shell, and the /identify page's
 * Document tile.
 */
export function ScanEntryButton({
  barnId,
  horseId,
  mode,
  label = "Scan document",
  variant = "primary",
  className,
  onComplete,
}: {
  barnId: string;
  horseId?: string;
  mode: ScanMode;
  label?: string;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
  onComplete?: (result: ScanResult) => void;
}) {
  const [open, setOpen] = useState(false);

  const baseClass =
    variant === "primary"
      ? "rounded-lg bg-brass-gold px-4 py-2 text-sm font-semibold text-barn-dark hover:brightness-110"
      : variant === "secondary"
        ? "rounded-lg border border-barn-dark/15 bg-white px-4 py-2 text-sm font-medium text-barn-dark hover:bg-parchment"
        : "text-sm text-barn-dark/70 hover:text-barn-dark";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${baseClass} ${className ?? ""}`}
      >
        {label}
      </button>
      <ScanModal
        open={open}
        onClose={() => setOpen(false)}
        barnId={barnId}
        horseId={horseId}
        mode={mode}
        onComplete={(r) => {
          setOpen(false);
          onComplete?.(r);
        }}
      />
    </>
  );
}
