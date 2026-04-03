"use client";

import { cn } from "@/lib/cn";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

type ToastContextValue = {
  show: (message: string, variant?: "default" | "success" | "error") => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      show: () => {
        /* no-op outside provider */
      },
    };
  }
  return ctx;
}

const variantStyles = {
  default: "border-brass-gold/40 bg-brass-gold/10 text-barn-dark",
  success: "border-barn-green/40 bg-barn-green/10 text-barn-dark",
  error: "border-barn-red/40 bg-barn-red/10 text-barn-dark",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [variant, setVariant] = useState<keyof typeof variantStyles>("default");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((msg: string, v: keyof typeof variantStyles = "default") => {
    setMessage(msg);
    setVariant(v);
    setOpen(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setOpen(false), 4200);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        className={cn(
          "pointer-events-none fixed bottom-24 left-1/2 z-[100] max-w-[min(100%-2rem,24rem)] -translate-x-1/2 transition md:bottom-8",
          open ? "opacity-100" : "opacity-0",
        )}
        aria-live="polite"
      >
        {open && message ? (
          <div
            className={cn(
              "pointer-events-auto rounded-xl border px-4 py-3 text-center text-sm shadow-lg",
              variantStyles[variant],
            )}
            role="status"
          >
            {message}
          </div>
        ) : null}
      </div>
    </ToastContext.Provider>
  );
}
