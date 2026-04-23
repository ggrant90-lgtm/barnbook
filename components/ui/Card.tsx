import { cn } from "@/lib/cn";
import type { HTMLAttributes, ReactNode } from "react";

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  /** Padding density */
  padding?: "none" | "sm" | "md";
};

const paddingClass = {
  none: "",
  sm: "p-4",
  md: "p-5 sm:p-6",
};

export function Card({ children, className, padding = "md", ...rest }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-barn-dark/10 bg-white shadow-sm",
        paddingClass[padding],
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
