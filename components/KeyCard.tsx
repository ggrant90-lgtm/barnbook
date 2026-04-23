"use client";

import {
  deleteAccessKeyAction,
  setAccessKeyActiveAction,
} from "@/app/(protected)/actions/keys";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { maskKeyCode } from "@/lib/key-code";
import {
  PERMISSION_LEVEL_LABELS,
  PERMISSION_LEVEL_COLORS,
  PERMISSION_LEVEL_EMOJI,
  normalizePermissionLevel,
} from "@/lib/key-permissions";
import { logTypeLabel } from "@/lib/horse-form-constants";
import type { AccessKey } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

export type KeyCardProps = {
  accessKey: AccessKey;
  onCopied?: () => void;
};

export function KeyCard({ accessKey: k, onCopied }: KeyCardProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const masked = maskKeyCode(k.key_code);

  const copyFull = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(k.key_code);
      onCopied?.();
    } catch {
      /* ignore */
    }
  }, [k.key_code, onCopied]);

  const toggle = async () => {
    setPending(true);
    await setAccessKeyActiveAction(k.id, !k.is_active);
    setPending(false);
    router.refresh();
  };

  const remove = async () => {
    if (!confirm("Delete this key permanently?")) return;
    setPending(true);
    await deleteAccessKeyAction(k.id);
    setPending(false);
    router.refresh();
  };

  const exp = k.expires_at
    ? new Date(k.expires_at).toLocaleDateString(undefined, { dateStyle: "medium" })
    : "—";
  const max = k.max_uses != null ? String(k.max_uses) : "∞";

  const level = normalizePermissionLevel(k.permission_level);
  const levelLabel = level ? PERMISSION_LEVEL_LABELS[level] : "Unknown";
  const levelColors = level
    ? PERMISSION_LEVEL_COLORS[level]
    : { bg: "#e5e7eb", fg: "#6b7280" };
  const levelEmoji = level ? PERMISSION_LEVEL_EMOJI[level] : "";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allowedTypes = (k as any).allowed_log_types as string[] | null | undefined;

  return (
    <li className="list-none">
      <Card padding="sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-barn-dark">{k.label?.trim() || "Untitled key"}</p>
              <span
                className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium"
                style={{ background: levelColors.bg, color: levelColors.fg }}
              >
                <span>{levelEmoji}</span>
                {levelLabel}
              </span>
            </div>
            <p className="mt-1 font-mono text-sm tracking-wide text-barn-dark/80">{masked}</p>
            {level === "custom" && Array.isArray(allowedTypes) && allowedTypes.length > 0 ? (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {allowedTypes.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium"
                    style={{ background: "#f5e6d3", color: "#8b4a2b" }}
                  >
                    {logTypeLabel(t)}
                  </span>
                ))}
              </div>
            ) : null}
            <p className="mt-2 text-xs text-barn-dark/55">
              Used {k.times_used} / {max}
              {k.expires_at ? ` · Expires ${exp}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => void copyFull()} disabled={pending}>
              Copy code
            </Button>
            <Button type="button" variant="secondary" onClick={() => void toggle()} disabled={pending}>
              {k.is_active ? "Deactivate" : "Activate"}
            </Button>
            <Button type="button" variant="danger" onClick={() => void remove()} disabled={pending}>
              Delete
            </Button>
          </div>
        </div>
      </Card>
    </li>
  );
}
