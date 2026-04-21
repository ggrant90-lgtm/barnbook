import type { BarnType } from "@/lib/barn-types";

/**
 * Small glyph distinguishing barn types at a glance. Used by the barn
 * switcher dropdown, the barn-creation type picker, and the dashboard's
 * barn cards.
 *
 * Pure SVG, no asset dependency. Matches stroke weight + color tone of
 * the rest of the app.
 */
export function BarnTypeIcon({
  type,
  size = 18,
  className,
}: {
  type: BarnType;
  size?: number;
  className?: string;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": "true" as const,
    className,
  };

  if (type === "mare_motel") {
    // Stylized crescent + dot — a "temporary stay" visual cue.
    return (
      <svg {...common}>
        <path d="M21 12.8a8.5 8.5 0 1 1-9.8-9.8 7 7 0 0 0 9.8 9.8z" />
        <circle cx="16.5" cy="6.5" r="1" fill="currentColor" />
      </svg>
    );
  }
  if (type === "service") {
    // Toolbox: mobile-worker workspace.
    return (
      <svg {...common}>
        <path d="M4 9h16v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9z" />
        <path d="M8 9V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v3" />
        <path d="M4 13h16" />
      </svg>
    );
  }
  // standard barn — classic barn silhouette
  return (
    <svg {...common}>
      <path d="M4 21V9l8-5 8 5v12" />
      <path d="M9 21v-6h6v6" />
      <path d="M4 9h16" />
    </svg>
  );
}
