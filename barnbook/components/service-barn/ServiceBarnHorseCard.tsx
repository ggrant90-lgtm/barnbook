"use client";

import Link from "next/link";
import type { Horse } from "@/lib/types";

/**
 * Dense list row for the Service Barn horse list — optimized for
 * providers scanning 30+ horses quickly. No photos, no silhouette
 * placeholders, no multi-line padding — just a tappable row with the
 * name, the essential secondary info, a type badge, and the two
 * primary actions.
 *
 * Desktop: one line; mobile: stacks to two (name row + actions row).
 */

type Variant =
  | { kind: "quick"; horse: Horse }
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

  // Secondary info line: owner+location for quick, owning-barn for linked.
  const subtitle =
    variant.kind === "quick"
      ? [horse.owner_contact_name, horse.location_name]
          .filter(Boolean)
          .join(" · ")
      : `at ${variant.owningBarnName}`;

  const viewHref = `/horses/${horse.id}`;
  const viewLabel = variant.kind === "quick" ? "History" : "Profile";

  // Tiny badge — one character, forest/slate tint.
  const badge =
    variant.kind === "quick"
      ? { text: "Q", title: "Quick record", bg: "rgba(201,168,76,0.18)", fg: "#7a5c13" }
      : { text: "L", title: "Linked horse", bg: "rgba(75,100,121,0.16)", fg: "#2a4031" };

  return (
    <div
      className="rounded-lg border bg-white px-3 py-2 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3"
      style={{ borderColor: "rgba(42,64,49,0.1)" }}
    >
      {/* Name + subtitle + badge — single line on desktop */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span
          aria-label={badge.title}
          title={badge.title}
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold"
          style={{ background: badge.bg, color: badge.fg }}
        >
          {badge.text}
        </span>
        <span className="font-medium text-barn-dark truncate">{horse.name}</span>
        {subtitle && (
          <span className="text-xs text-barn-dark/55 truncate hidden sm:inline">
            &middot; {subtitle}
          </span>
        )}
      </div>

      {/* Mobile-only subtitle row (avoids cramming it on one line with
          the name on small screens) */}
      {subtitle && (
        <div className="text-xs text-barn-dark/55 truncate sm:hidden -mt-1">
          {subtitle}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={() => onLog(horse.id)}
          className="min-h-[36px] rounded-md px-2.5 py-1 text-xs font-semibold"
          style={{ background: "#c9a84c", color: "#2a4031" }}
        >
          Log
        </button>
        <Link
          href={viewHref}
          className="min-h-[36px] inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium text-barn-dark hover:bg-parchment"
          style={{ borderColor: "rgba(42,64,49,0.15)" }}
        >
          {viewLabel}
        </Link>
        {variant.kind === "linked" && onUnlink && (
          <button
            type="button"
            onClick={() => onUnlink(variant.linkId)}
            aria-label="Unlink"
            title="Unlink"
            className="min-h-[36px] w-7 inline-flex items-center justify-center rounded-md text-barn-dark/45 hover:text-[#b8421f]"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M9 17H6a4 4 0 1 1 0-8h3" />
              <path d="M15 7h3a4 4 0 1 1 0 8h-3" />
              <path d="M3 3l18 18" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
