"use client";

import Link from "next/link";
import type { Horse } from "@/lib/types";

/**
 * Unified card for the Service Barn horse list. Renders two variants:
 *   - quick: name + owner/location subtitle + "Quick Record" badge
 *   - linked: name + "at {owning barn}" subtitle + small photo +
 *     "Linked" badge
 *
 * Action buttons: Log entry + secondary (View history / View profile).
 */

type Variant =
  | {
      kind: "quick";
      horse: Horse;
    }
  | {
      kind: "linked";
      horse: Horse;
      owningBarnName: string;
      linkId: string;
    };

export function ServiceBarnHorseCard({
  variant,
  onLog,
  onUnlink,
}: {
  variant: Variant;
  onLog: (horseId: string) => void;
  onUnlink?: (linkId: string) => void;
}) {
  const { horse } = variant;
  const subtitle =
    variant.kind === "quick"
      ? [horse.owner_contact_name, horse.location_name]
          .filter(Boolean)
          .join(" — ") || "No owner or location yet"
      : `at ${variant.owningBarnName}`;

  const viewHref =
    variant.kind === "quick"
      ? `/horses/${horse.id}`
      : `/horses/${horse.id}`;
  const viewLabel = variant.kind === "quick" ? "View history" : "View profile";

  const badgeStyle =
    variant.kind === "quick"
      ? { background: "rgba(201,168,76,0.18)", color: "#7a5c13" }
      : { background: "rgba(75,100,121,0.14)", color: "#2a4031" };
  const badgeText = variant.kind === "quick" ? "Quick Record" : "Linked";

  return (
    <div
      className="rounded-2xl border bg-white p-4 shadow-sm"
      style={{ borderColor: "rgba(42,64,49,0.1)" }}
    >
      <div className="flex items-start gap-3">
        {variant.kind === "linked" && horse.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={horse.photo_url}
            alt=""
            style={{
              width: 48,
              height: 48,
              borderRadius: 10,
              objectFit: "cover",
              flexShrink: 0,
            }}
          />
        ) : (
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 10,
              background: "rgba(163,184,143,0.25)",
              flexShrink: 0,
            }}
            aria-hidden="true"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-serif text-lg font-semibold text-barn-dark truncate">
              {horse.name}
            </span>
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide"
              style={badgeStyle}
            >
              {badgeText}
            </span>
          </div>
          <div className="text-xs text-barn-dark/60 mt-0.5 truncate">
            {subtitle}
          </div>
          {variant.kind === "quick" && horse.color && (
            <div className="text-[11px] text-barn-dark/55 mt-0.5">
              Color: {horse.color}
            </div>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onLog(horse.id)}
          className="min-h-[40px] rounded-lg px-3 py-1.5 text-sm font-medium shadow"
          style={{ background: "#c9a84c", color: "#2a4031" }}
        >
          Log entry
        </button>
        <Link
          href={viewHref}
          className="min-h-[40px] inline-flex items-center rounded-lg border px-3 py-1.5 text-sm font-medium text-barn-dark hover:bg-parchment"
          style={{ borderColor: "rgba(42,64,49,0.15)" }}
        >
          {viewLabel}
        </Link>
        {variant.kind === "linked" && onUnlink && (
          <button
            type="button"
            onClick={() => onUnlink(variant.linkId)}
            className="text-xs text-barn-dark/55 underline"
          >
            Unlink
          </button>
        )}
      </div>
    </div>
  );
}
