"use client";

import { generateAccessKeyAction } from "@/app/(protected)/actions/keys";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { getJoinUrl } from "@/lib/site-url";
import { LOG_TYPES, logTypeLabel } from "@/lib/horse-form-constants";
import {
  PERMISSION_LEVELS,
  PERMISSION_LEVEL_LABELS,
  PERMISSION_LEVEL_DESCRIPTIONS,
  PERMISSION_LEVEL_EMOJI,
  type PermissionLevel,
} from "@/lib/key-permissions";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function GenerateKeyForm({
  barnName,
  horses,
  initialType,
  initialHorseId,
}: {
  barnName: string;
  horses: { id: string; name: string }[];
  initialType: "barn" | "stall";
  initialHorseId: string | null;
}) {
  const router = useRouter();
  const [keyKind, setKeyKind] = useState<"barn" | "stall">(initialType);
  const [horseId, setHorseId] = useState(initialHorseId ?? horses[0]?.id ?? "");
  const [permissionLevel, setPermissionLevel] =
    useState<PermissionLevel>("log_all");
  const [allowedLogTypes, setAllowedLogTypes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);

  const joinUrl = getJoinUrl();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    // Client-side validation: custom requires at least one allowed type.
    if (permissionLevel === "custom" && allowedLogTypes.length === 0) {
      setError("Pick at least one log type for custom permissions.");
      return;
    }

    setPending(true);
    const fd = new FormData(e.currentTarget);
    fd.set("key_kind", keyKind);
    if (keyKind === "stall") fd.set("horse_id", horseId);
    fd.set("permission_level", permissionLevel);
    if (permissionLevel === "custom") {
      for (const t of allowedLogTypes) fd.append("allowed_log_types[]", t);
    }
    const res = await generateAccessKeyAction(null, fd);
    setPending(false);
    if (res?.error) {
      setError(res.error);
      return;
    }
    if (res?.plainKey) setRevealed(res.plainKey);
    router.refresh();
  }

  function toggleLogType(t: string) {
    setAllowedLogTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  }

  async function shareKey(code: string) {
    const shareUrl = `${joinUrl}?key=${encodeURIComponent(code)}`;
    const text = `Join ${barnName} on BarnBook: ${shareUrl}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `Join ${barnName} on BarnBook`, text, url: shareUrl });
      } else {
        await navigator.clipboard.writeText(text);
      }
    } catch {
      /* user cancelled or failed */
    }
  }

  if (revealed) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 sm:px-6">
        <Link href="/keys" className="text-sm text-barn-dark/70 hover:text-brass-gold">
          ← Keys
        </Link>
        <h1 className="mt-6 font-serif text-3xl font-semibold text-barn-dark">Key created</h1>
        <p className="mt-2 text-barn-dark/70">{barnName}</p>

        <Card className="mt-10 border-2 border-brass-gold/40" padding="md">
          <p className="text-xs font-medium uppercase tracking-wide text-barn-dark/50">Your key</p>
          <p className="mt-3 break-all font-mono text-2xl font-semibold tracking-wide text-barn-dark">
            {revealed}
          </p>
          <p className="mt-4 text-sm leading-relaxed text-barn-dark/75">
            Share this key with the person who needs access. They&apos;ll enter it at{" "}
            <span className="font-medium text-barn-dark">{joinUrl}</span>
          </p>
          <p className="mt-2 text-xs text-barn-dark/50">
            Or share the direct link:{" "}
            <span className="break-all font-mono text-barn-dark/70">
              {joinUrl}?key={revealed}
            </span>
          </p>
        </Card>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button
            type="button"
            className="w-full sm:w-auto sm:flex-1"
            onClick={() => void navigator.clipboard.writeText(revealed)}
          >
            Copy key
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="w-full sm:w-auto sm:flex-1"
            onClick={() => void shareKey(revealed)}
          >
            Share (text / email)
          </Button>
        </div>

        <Link href="/keys" className="mt-10 inline-block text-sm font-medium text-brass-gold hover:underline">
          Back to key dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10 sm:px-6">
      <Link href="/keys" className="text-sm text-barn-dark/70 hover:text-brass-gold">
        ← Keys
      </Link>
      <h1 className="mt-6 font-serif text-3xl font-semibold text-barn-dark">Generate key</h1>
      <p className="mt-2 text-barn-dark/70">{barnName}</p>

      <form onSubmit={onSubmit} className="mt-10 space-y-5">
        <div>
          <span className="mb-2 block text-sm font-medium text-barn-dark/80">Key type</span>
          <div className="flex flex-wrap gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-barn-dark">
              <input
                type="radio"
                name="key_kind_radio"
                checked={keyKind === "barn"}
                onChange={() => setKeyKind("barn")}
              />
              Barn key
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-barn-dark">
              <input
                type="radio"
                name="key_kind_radio"
                checked={keyKind === "stall"}
                onChange={() => setKeyKind("stall")}
              />
              Stall key
            </label>
          </div>
        </div>

        {keyKind === "stall" ? (
          <Select
            label="Horse"
            id="horse_id"
            name="horse_id"
            required
            value={horseId}
            onChange={(e) => setHorseId(e.target.value)}
          >
            {horses.length === 0 ? (
              <option value="">No horses — add one first</option>
            ) : (
              horses.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))
            )}
          </Select>
        ) : null}

        <Input id="label" name="label" label="Label" placeholder="e.g. Farrier access" />

        <div>
          <span className="mb-2 block text-sm font-medium text-barn-dark/80">
            Permission level
          </span>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {PERMISSION_LEVELS.map((level) => {
              const active = permissionLevel === level;
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => setPermissionLevel(level)}
                  className="rounded-xl border p-3 text-left transition"
                  style={{
                    borderColor: active
                      ? "var(--brass-gold, #c9a84c)"
                      : "rgba(42, 64, 49, 0.15)",
                    background: active
                      ? "rgba(201, 168, 76, 0.08)"
                      : "white",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">
                      {PERMISSION_LEVEL_EMOJI[level]}
                    </span>
                    <span className="text-sm font-semibold text-barn-dark">
                      {PERMISSION_LEVEL_LABELS[level]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-snug text-barn-dark/65">
                    {PERMISSION_LEVEL_DESCRIPTIONS[level]}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {permissionLevel === "custom" ? (
          <div
            className="rounded-xl border p-3"
            style={{
              borderColor: "rgba(42, 64, 49, 0.15)",
              background: "#fafaf3",
            }}
          >
            <span className="mb-2 block text-sm font-medium text-barn-dark/80">
              Allowed log types
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {LOG_TYPES.map((t) => {
                const checked = allowedLogTypes.includes(t);
                return (
                  <label
                    key={t}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm text-barn-dark hover:bg-barn-dark/5"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleLogType(t)}
                      className="h-4 w-4"
                    />
                    {logTypeLabel(t)}
                  </label>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-barn-dark/55">
              Unchecked types will be hidden from this person&apos;s log entry form.
            </p>
          </div>
        ) : null}

        <Input
          id="max_uses"
          name="max_uses"
          type="number"
          min={1}
          label="Max uses (optional)"
          placeholder="Unlimited if empty"
        />

        <Input id="expires_at" name="expires_at" type="date" label="Expiry date (optional)" />

        {error ? (
          <p className="rounded-lg border border-barn-red/40 bg-barn-red/10 px-3 py-2 text-sm text-barn-dark" role="alert">
            {error}
          </p>
        ) : null}

        <Button
          type="submit"
          block
          disabled={pending || (keyKind === "stall" && horses.length === 0)}
        >
          {pending ? "Creating…" : "Generate key"}
        </Button>
      </form>
    </div>
  );
}
