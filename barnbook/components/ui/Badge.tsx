import { cn } from "@/lib/cn";
import type { HTMLAttributes, ReactNode } from "react";

export type BadgeVariant = "active" | "inactive" | "pending" | "neutral" | "success" | "warning";

const styles: Record<BadgeVariant, string> = {
  active: "border-barn-green/40 bg-barn-green/10 text-barn-dark",
  inactive: "border-barn-dark/20 bg-barn-dark/5 text-barn-dark/70",
  pending: "border-brass-gold/50 bg-brass-gold/15 text-barn-dark",
  neutral: "border-barn-dark/15 bg-white text-barn-dark/80",
  success: "border-barn-green/40 bg-barn-green/10 text-barn-dark",
  warning: "border-barn-warning/40 bg-barn-warning/10 text-barn-dark",
};

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode;
  variant?: BadgeVariant;
};

export function Badge({ children, variant = "neutral", className, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        styles[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
