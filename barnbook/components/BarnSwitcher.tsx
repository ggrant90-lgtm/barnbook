"use client";

import { switchBarnAction } from "@/app/(protected)/actions/switch-barn";
import type { BarnSummary } from "@/components/protected/ProtectedChrome";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function BarnSwitcher({
  allBarns,
  activeBarnId,
}: {
  allBarns: BarnSummary[];
  activeBarnId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  if (allBarns.length === 0) return null;

  async function handleSwitch(barnId: string) {
    setOpen(false);
    await switchBarnAction(barnId);
    router.refresh();
  }

  const activeBarn = allBarns.find((b) => b.id === activeBarnId);

  return (
    <div className="relative px-4 py-3 border-b border-brass-gold/10">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-lg bg-barn-panel/50 px-3 py-2 text-left transition hover:bg-barn-panel"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-parchment">
            {activeBarn?.name ?? "Select barn"}
          </p>
          {activeBarn?.barn_type === "mare_motel" ? (
            <span className="text-[10px] text-brass-gold">Mare Motel</span>
          ) : null}
        </div>
        <svg
          className={`ml-2 h-4 w-4 shrink-0 text-muted-tan transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open ? (
        <div className="absolute left-4 right-4 z-50 mt-1 rounded-xl border border-brass-gold/15 bg-barn-dark shadow-lg">
          <ul className="max-h-60 overflow-y-auto py-1">
            {allBarns.map((barn) => (
              <li key={barn.id}>
                <button
                  type="button"
                  onClick={() => handleSwitch(barn.id)}
                  className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition hover:bg-barn-panel ${
                    barn.id === activeBarnId ? "text-brass-gold" : "text-parchment"
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate">{barn.name}</span>
                  {barn.barn_type === "mare_motel" ? (
                    <span className="shrink-0 rounded-full bg-brass-gold/15 px-1.5 py-0.5 text-[9px] text-brass-gold">
                      MM
                    </span>
                  ) : null}
                  {barn.id === activeBarnId ? (
                    <svg className="h-4 w-4 shrink-0 text-brass-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t border-brass-gold/10 p-2">
            <Link
              href="/barn/new"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-tan transition hover:bg-barn-panel hover:text-parchment"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Create new barn
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
