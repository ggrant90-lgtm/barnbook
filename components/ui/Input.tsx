import { cn } from "@/lib/cn";
import type { InputHTMLAttributes, ReactNode } from "react";

const fieldClass =
  "w-full rounded-xl border border-barn-dark/15 bg-white px-3 py-2 text-sm text-barn-dark outline-none transition placeholder:text-barn-dark/40 focus:border-brass-gold focus:ring-2 focus:ring-brass-gold/25 disabled:bg-barn-dark/5 disabled:text-barn-dark/60";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string | null;
  /** Extra wrapper for layout */
  className?: string;
};

export function Input({ label, error, id, className, ...rest }: InputProps) {
  const inputId = id ?? rest.name;
  return (
    <div className={cn("space-y-1", className)}>
      {label ? (
        <label htmlFor={inputId} className="block text-xs font-medium text-barn-dark/60">
          {label}
        </label>
      ) : null}
      <input
        id={inputId}
        className={cn(fieldClass, error && "border-barn-red/60 focus:border-barn-red focus:ring-barn-red/20")}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${inputId}-error` : undefined}
        {...rest}
      />
      {error ? (
        <p id={`${inputId}-error`} className="text-xs text-barn-red" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
