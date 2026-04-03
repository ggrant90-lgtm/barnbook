"use client";

import {
  deleteAccessKeyAction,
  setAccessKeyActiveAction,
} from "@/app/(protected)/actions/keys";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { maskKeyCode } from "@/lib/key-code";
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

  return (
    <li className="list-none">
      <Card padding="sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="font-medium text-barn-dark">{k.label?.trim() || "Untitled key"}</p>
            <p className="mt-1 font-mono text-sm tracking-wide text-barn-dark/80">{masked}</p>
            <p className="mt-2 text-xs text-barn-dark/55">
              {k.permission_level === "editor" ? "Editor" : "Viewer"} · Used {k.times_used} / {max}
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
