import { cn } from "@/lib/cn";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

const baseButtonClass =
  "inline-flex min-h-[44px] items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment disabled:pointer-events-none disabled:opacity-50";

export const buttonVariantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-brass-gold text-barn-dark shadow hover:brightness-110 focus-visible:ring-brass-gold/50",
  secondary:
    "border border-barn-dark/20 bg-white text-barn-dark hover:border-brass-gold focus-visible:ring-brass-gold/30",
  danger:
    "border border-barn-red/40 bg-white text-barn-red hover:bg-barn-red/5 focus-visible:ring-barn-red/30",
  ghost: "bg-transparent text-barn-dark hover:bg-barn-dark/5 focus-visible:ring-barn-dark/20",
};

/** Use on `<Link>` to match `<Button variant="…" />` styles. */
export function linkButtonClass(variant: ButtonVariant = "primary", extra?: string): string {
  return cn(baseButtonClass, buttonVariantClasses[variant], extra);
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  children: ReactNode;
  /** When true, full width on mobile-friendly forms */
  block?: boolean;
};

export function Button({
  variant = "primary",
  className,
  children,
  block,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={cn(baseButtonClass, buttonVariantClasses[variant], block && "w-full", className)}
      {...rest}
    >
      {children}
    </button>
  );
}
