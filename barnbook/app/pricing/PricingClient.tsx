"use client";

import { useState } from "react";
import InterestModal from "@/components/InterestModal";

export default function PricingClient({
  planKey,
  planName,
  label,
  variant,
}: {
  planKey: string;
  planName: string;
  label: string;
  variant: "tier" | "addon" | "commissioned" | "commissioned-highlight";
}) {
  const [open, setOpen] = useState(false);

  const baseClasses =
    "w-full inline-flex items-center justify-center rounded-full font-sans font-medium text-[14px] no-underline transition-all hover:-translate-y-px cursor-pointer";

  const variantClasses: Record<string, string> = {
    tier: "py-3 px-6 bg-[#c9a84c] text-[var(--ink)] hover:brightness-110",
    addon:
      "py-3 px-6 bg-forest text-cream hover:bg-forest-deep",
    commissioned:
      "py-3 px-6 bg-forest text-cream hover:bg-forest-deep",
    "commissioned-highlight":
      "py-3 px-6 bg-[#c9a84c] text-[var(--ink)] hover:brightness-110",
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        data-plan={planKey}
        className={`${baseClasses} ${variantClasses[variant]}`}
      >
        {label}
      </button>
      <InterestModal
        isOpen={open}
        onClose={() => setOpen(false)}
        planName={planName}
        planKey={planKey}
      />
    </>
  );
}
