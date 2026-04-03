import { cn } from "@/lib/cn";
import type { ReactNode, SelectHTMLAttributes } from "react";

const fieldClass =
  "w-full rounded-xl border border-barn-dark/15 bg-white px-3 py-2 text-sm text-barn-dark outline-none focus:border-brass-gold focus:ring-2 focus:ring-brass-gold/25 disabled:bg-barn-dark/5";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string | null;
  children: ReactNode;
  className?: string;
};

export function Select({ label, error, id, className, children, ...rest }: SelectProps) {
  const selectId = id ?? rest.name;
  return (
    <div className={cn("space-y-1", className)}>
      {label ? (
        <label htmlFor={selectId} className="block text-xs font-medium text-barn-dark/60">
          {label}
        </label>
      ) : null}
      <select
        id={selectId}
        className={cn(fieldClass, error && "border-barn-red/60")}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${selectId}-error` : undefined}
        {...rest}
      >
        {children}
      </select>
      {error ? (
        <p id={`${selectId}-error`} className="text-xs text-barn-red" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
