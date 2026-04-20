"use client";

/**
 * Small pill badge shown in a module's chrome when a user is on a free
 * trial. Gets warmer as the trial nears expiration:
 *   - Days 30–6: muted parchment/forest
 *   - Days 5–2:  amber
 *   - Day 1 / ≤0: amber + gentle pulse
 */
export function TrialBadge({ daysLeft }: { daysLeft: number }) {
  const tone: "calm" | "warm" | "urgent" =
    daysLeft <= 1 ? "urgent" : daysLeft <= 5 ? "warm" : "calm";

  const styles =
    tone === "urgent"
      ? { bg: "rgba(201,168,76,0.25)", fg: "#7a5c13", ring: "#c9a84c" }
      : tone === "warm"
        ? { bg: "rgba(201,168,76,0.15)", fg: "#7a5c13", ring: "transparent" }
        : { bg: "rgba(42,64,49,0.08)", fg: "#2a4031", ring: "transparent" };

  const label =
    daysLeft <= 0
      ? "Trial ends today"
      : daysLeft === 1
        ? "Trial ends tomorrow"
        : `Trial — ${daysLeft} days left`;

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{
        background: styles.bg,
        color: styles.fg,
        boxShadow: `inset 0 0 0 1px ${styles.ring}`,
        animation: tone === "urgent" ? "trialpulse 1800ms ease-in-out infinite" : undefined,
      }}
      aria-label={label}
    >
      <span
        aria-hidden="true"
        style={{
          display: "inline-block",
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: tone === "calm" ? "#2a4031" : "#c9a84c",
        }}
      />
      {label}
      <style jsx>{`
        @keyframes trialpulse {
          0%,100% { box-shadow: inset 0 0 0 1px #c9a84c, 0 0 0 0 rgba(201,168,76,0.35); }
          50%     { box-shadow: inset 0 0 0 1px #c9a84c, 0 0 0 4px rgba(201,168,76,0.12); }
        }
      `}</style>
    </span>
  );
}
