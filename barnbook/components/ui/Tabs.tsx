"use client";

import { cn } from "@/lib/cn";

export type TabItem = { id: string; label: string };

export type TabsProps = {
  items: TabItem[];
  value: string;
  onValueChange: (id: string) => void;
  className?: string;
  /** For a11y: link tab panels */
  tabListClassName?: string;
};

export function Tabs({ items, value, onValueChange, className, tabListClassName }: TabsProps) {
  return (
    <div className={cn("flex gap-1 overflow-x-auto border-b border-barn-dark/10 pb-px", className)}>
      {items.map((t) => {
        const selected = value === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={selected}
            id={`tab-${t.id}`}
            onClick={() => onValueChange(t.id)}
            className={cn(
              "shrink-0 rounded-t-lg px-4 py-2.5 text-sm font-medium transition",
              selected
                ? "bg-white text-barn-dark shadow-sm ring-1 ring-barn-dark/10"
                : "text-barn-dark/55 hover:text-barn-dark",
              tabListClassName,
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
