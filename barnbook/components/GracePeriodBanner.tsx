"use client";

import { graceDaysRemaining } from "@/lib/plans";
import Link from "next/link";

export function GracePeriodBanner({
  barn,
  barnId,
}: {
  barn: { grace_period_ends_at: string | null; stall_capacity: number };
  barnId: string;
}) {
  const days = graceDaysRemaining(barn);
  if (days === null) return null;

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-red-500">⚠</span>
        <div className="flex-1">
          <p className="text-sm font-medium text-red-800">
            This barn is over capacity
          </p>
          <p className="mt-1 text-sm text-red-700/80">
            {days > 0
              ? `You have ${days} day${days !== 1 ? "s" : ""} to upgrade or remove horses.`
              : "Grace period has expired. Please upgrade or remove horses to continue."}
          </p>
          <div className="mt-2 flex gap-2">
            <Link
              href={`/horses`}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
            >
              Manage horses
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
