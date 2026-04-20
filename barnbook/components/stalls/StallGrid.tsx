/**
 * Visual stall grid: small squares in a flex-wrap layout.
 *   - `baseCount` squares in sage (#a3b88f) — existing/base stalls.
 *   - `newCount`  squares in brass gold (#c9a84c) — stalls being added.
 *
 * Used in the Build-A-Barn confirmation step so the user can *see* the
 * stalls they're about to claim.
 */

export function StallGrid({
  baseCount,
  newCount,
  showLegend = true,
}: {
  baseCount: number;
  newCount: number;
  showLegend?: boolean;
}) {
  const squares: Array<{ key: string; kind: "base" | "new" }> = [];
  for (let i = 0; i < baseCount; i++) squares.push({ key: `b${i}`, kind: "base" });
  for (let i = 0; i < newCount; i++) squares.push({ key: `n${i}`, kind: "new" });

  return (
    <div>
      <div
        className="flex flex-wrap gap-1.5 rounded-xl border border-barn-dark/10 bg-parchment/40 p-3"
        aria-label={`Stall grid: ${baseCount} existing, ${newCount} new`}
      >
        {squares.map((sq) => (
          <span
            key={sq.key}
            aria-hidden="true"
            style={{
              width: 14,
              height: 14,
              borderRadius: 3,
              background: sq.kind === "base" ? "#a3b88f" : "#c9a84c",
              boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.06)",
            }}
          />
        ))}
        {squares.length === 0 && (
          <span className="text-xs text-barn-dark/50">No stalls yet</span>
        )}
      </div>

      {showLegend && (
        <div className="mt-2 flex items-center gap-4 text-xs text-barn-dark/70">
          <LegendDot color="#a3b88f" />
          <span>
            Existing · {baseCount}
          </span>
          <LegendDot color="#c9a84c" />
          <span>
            New · {newCount}
          </span>
          <span className="ml-auto font-medium text-barn-dark">
            Total · {baseCount + newCount}
          </span>
        </div>
      )}
    </div>
  );
}

function LegendDot({ color }: { color: string }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 10,
        height: 10,
        borderRadius: 2,
        background: color,
        display: "inline-block",
        boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.06)",
      }}
    />
  );
}
