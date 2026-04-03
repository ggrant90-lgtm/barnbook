"use client";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { ReactNode } from "react";
import { useEffect } from "react";

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** e.g. for form id on primary action */
  className?: string;
};

export function Modal({ open, onClose, title, description, children, footer, className }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal
        aria-labelledby="modal-title"
        className={cn(
          "w-full max-w-md rounded-2xl border border-barn-dark/10 bg-white p-6 shadow-xl",
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="modal-title" className="font-serif text-lg text-barn-dark">
          {title}
        </h2>
        {description ? <p className="mt-1 text-sm text-barn-dark/65">{description}</p> : null}
        <div className="mt-4">{children}</div>
        {footer ? <div className="mt-6 flex justify-end gap-2">{footer}</div> : null}
        {!footer ? (
          <div className="mt-6 flex justify-end">
            <Button type="button" variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
