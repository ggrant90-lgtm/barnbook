"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { linkHorseToServiceBarnAction } from "@/app/(protected)/actions/service-barn-links";
import { ErrorDetails } from "@/components/ui/ErrorDetails";

/**
 * Modal for picking horses the current user holds Stall Keys for and
 * linking them into a Service Barn. Hides any horses already linked.
 *
 * We fetch the stall-key horse list from the browser via the same
 * query shape used server-side on the dashboard — it's user-scoped
 * data so the authenticated supabase client + existing RLS handle it.
 */

interface StallHorseRow {
  horseId: string;
  horseName: string;
  owningBarnName: string;
  permissionLevel: string | null;
  photoUrl: string | null;
}

export function LinkHorseModal({
  serviceBarnId,
  serviceBarnName,
  alreadyLinkedHorseIds,
  onClose,
}: {
  serviceBarnId: string;
  serviceBarnName: string;
  alreadyLinkedHorseIds: string[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<StallHorseRow[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  const excluded = new Set(alreadyLinkedHorseIds);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    (async () => {
      try {
        const { data: userRes } = await supabase.auth.getUser();
        const userId = userRes.user?.id;
        if (!userId) {
          setError("Not authenticated");
          setRows([]);
          return;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: access } = await (supabase as any)
          .from("user_horse_access")
          .select("horse_id, permission_level")
          .eq("user_id", userId);
        const accessRows = (access ?? []) as Array<{
          horse_id: string;
          permission_level: string | null;
        }>;
        const ids = accessRows
          .map((a) => a.horse_id)
          .filter((id) => !excluded.has(id));
        if (ids.length === 0) {
          setRows([]);
          return;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: horses } = await (supabase as any)
          .from("horses")
          .select("id, name, barn_id, photo_url")
          .in("id", ids)
          .eq("archived", false)
          .order("name", { ascending: true });
        const horseRows = (horses ?? []) as Array<{
          id: string;
          name: string;
          barn_id: string;
          photo_url: string | null;
        }>;
        const barnIds = [...new Set(horseRows.map((h) => h.barn_id))];
        const barnNames: Record<string, string> = {};
        if (barnIds.length > 0) {
          const { data: barns } = await supabase
            .from("barns")
            .select("id, name")
            .in("id", barnIds);
          for (const b of (barns ?? []) as { id: string; name: string }[]) {
            barnNames[b.id] = b.name;
          }
        }
        const perm = new Map(accessRows.map((a) => [a.horse_id, a.permission_level]));
        setRows(
          horseRows.map((h) => ({
            horseId: h.id,
            horseName: h.name,
            owningBarnName: barnNames[h.barn_id] ?? "Barn",
            permissionLevel: perm.get(h.id) ?? null,
            photoUrl: h.photo_url,
          })),
        );
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Failed to load horses",
        );
        setRows([]);
      }
    })();
  }, [excluded]);

  // Escape to close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleLink() {
    if (selectedIds.size === 0) return;
    setError(null);
    startTransition(async () => {
      // Fire links sequentially for clearer error reporting. For small
      // selection counts this is fine; if it ever gets large we can
      // switch to Promise.all.
      for (const horseId of selectedIds) {
        const res = await linkHorseToServiceBarnAction({
          serviceBarnId,
          horseId,
        });
        if (res.error) {
          setError(res.error);
          return;
        }
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Link a horse"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 70,
        background: "rgba(42,64,49,0.75)",
        display: "flex",
        alignItems: "stretch",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="sm:my-8 sm:max-h-[92vh] sm:rounded-2xl"
        style={{
          background: "white",
          width: "100%",
          maxWidth: 520,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid rgba(0,0,0,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <div>
            <div className="font-serif text-lg font-semibold text-barn-dark">
              Link horses to {serviceBarnName}
            </div>
            <div className="text-xs text-barn-dark/55 mt-0.5">
              Pick horses you have Stall Key access to.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-barn-dark/60 hover:bg-parchment"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
          {rows === null ? (
            <p className="text-sm text-barn-dark/60">Loading your horses…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-barn-dark/60">
              No new horses to link. When someone grants you a Stall Key,
              we&apos;ll offer to link it here automatically.
            </p>
          ) : (
            <ul className="space-y-1">
              {rows.map((r) => {
                const selected = selectedIds.has(r.horseId);
                return (
                  <li key={r.horseId}>
                    <button
                      type="button"
                      onClick={() => toggle(r.horseId)}
                      aria-pressed={selected}
                      className="w-full rounded-lg border px-3 py-2 flex items-center gap-2.5 text-left"
                      style={{
                        borderColor: selected ? "#c9a84c" : "rgba(42,64,49,0.12)",
                        background: selected ? "rgba(201,168,76,0.08)" : "white",
                      }}
                    >
                      <div
                        aria-hidden="true"
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: 4,
                          border: selected
                            ? "5px solid #c9a84c"
                            : "2px solid rgba(42,64,49,0.35)",
                          flexShrink: 0,
                        }}
                      />
                      <div className="min-w-0 flex-1 flex flex-wrap items-baseline gap-x-2">
                        <span className="font-medium text-barn-dark truncate">
                          {r.horseName}
                        </span>
                        <span className="text-xs text-barn-dark/55 truncate">
                          at {r.owningBarnName}
                          {r.permissionLevel && (
                            <>
                              {" · "}
                              <span className="italic">
                                {r.permissionLevel.replace(/_/g, " ")}
                              </span>
                            </>
                          )}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {error && (
            <div className="mt-3">
              <ErrorDetails
                title="Couldn't link"
                message={error}
                extra={{ ServiceBarn: serviceBarnId }}
              />
            </div>
          )}
        </div>

        <div
          style={{
            padding: "12px 16px",
            borderTop: "1px solid rgba(0,0,0,0.08)",
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-lg border px-4 py-2 text-sm font-medium text-barn-dark hover:bg-parchment disabled:opacity-50"
            style={{ borderColor: "rgba(42,64,49,0.15)" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleLink}
            disabled={pending || selectedIds.size === 0}
            className="rounded-lg px-4 py-2 text-sm font-semibold shadow disabled:opacity-60"
            style={{ background: "#c9a84c", color: "#2a4031" }}
          >
            {pending
              ? "Linking…"
              : selectedIds.size === 0
                ? "Link"
                : `Link ${selectedIds.size}`}
          </button>
        </div>
      </div>
    </div>
  );
}
