"use client";

import { deleteBarnAction } from "@/app/(protected)/actions/barn";
import { switchBarnAction } from "@/app/(protected)/actions/switch-barn";
import type { BarnSummary } from "@/components/protected/ProtectedChrome";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function BarnSwitcher({
  allBarns,
  activeBarnId,
  onSwitch,
}: {
  allBarns: BarnSummary[];
  activeBarnId?: string | null;
  onSwitch?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  if (allBarns.length === 0) return null;

  async function handleSwitch(barnId: string) {
    setOpen(false);
    onSwitch?.();
    await switchBarnAction(barnId);
    router.push(window.location.pathname);
    router.refresh();
  }

  async function handleDelete(barnId: string) {
    setDeleting(true);
    const result = await deleteBarnAction(barnId);
    setDeleting(false);
    if (result?.error) {
      alert(result.error);
    } else {
      setConfirmDelete(null);
      setOpen(false);
      router.refresh();
    }
  }

  const isAllBarns = activeBarnId === "__all__";
  const activeBarn = isAllBarns ? null : allBarns.find((b) => b.id === activeBarnId);
  const showAllOption = allBarns.length > 1;

  return (
    <div className="relative px-4 py-3 border-b border-brass-gold/10">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-lg bg-barn-panel/50 px-3 py-2 text-left transition hover:bg-barn-panel"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-parchment">
            {isAllBarns ? "All Barns" : (activeBarn?.name ?? "Select barn")}
          </p>
          {!isAllBarns && activeBarn?.barn_type === "mare_motel" ? (
            <span className="text-[10px] text-brass-gold">Mare Motel</span>
          ) : isAllBarns ? (
            <span className="text-[10px] text-brass-gold">{allBarns.length} barns combined</span>
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
            {showAllOption && (
              <li>
                <button
                  type="button"
                  onClick={() => handleSwitch("__all__")}
                  className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition hover:bg-barn-panel ${
                    isAllBarns ? "text-brass-gold" : "text-parchment"
                  }`}
                >
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z" />
                  </svg>
                  <span className="flex-1">All Barns</span>
                  <span className="text-[10px] text-muted-tan">{allBarns.length}</span>
                  {isAllBarns && (
                    <svg className="h-4 w-4 shrink-0 text-brass-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              </li>
            )}
            {allBarns.map((barn) => (
              <li key={barn.id} className="group flex items-center">
                <button
                  type="button"
                  onClick={() => handleSwitch(barn.id)}
                  className={`flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left text-sm transition hover:bg-barn-panel ${
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
                {confirmDelete === barn.id ? (
                  <div className="flex shrink-0 items-center gap-1 pr-2">
                    <button
                      type="button"
                      disabled={deleting}
                      onClick={() => handleDelete(barn.id)}
                      className="rounded px-1.5 py-0.5 text-[10px] font-medium text-red-400 hover:bg-red-500/20 disabled:opacity-50"
                    >
                      {deleting ? "..." : "Yes"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(null)}
                      className="rounded px-1.5 py-0.5 text-[10px] text-muted-tan hover:bg-barn-panel"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setConfirmDelete(barn.id); }}
                    className="shrink-0 rounded p-1.5 text-muted-tan/0 transition group-hover:text-muted-tan hover:text-red-400 mr-1"
                    title="Delete barn"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
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
