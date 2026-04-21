"use client";

import { useState } from "react";

/**
 * Simple horizontal timeline showing a breeding milestone map:
 * breeding date → pregnancy checks (14d/30d/60d) → expected foaling.
 * "Today" is rendered as a vertical tick if it falls inside the range.
 *
 * Purpose-built for the Breeders Pro wizard's step 4. Not reusing
 * FoalOriginTimeline (that's vertical + assumes we have foaling data).
 */
export function WizardBreedingTimeline({
  mareName,
  breedingDate,
}: {
  mareName: string;
  breedingDate: string;
}) {
  // Snapshot "now" once on mount. The timeline is shown for a few
  // seconds at the end of the wizard — it doesn't need to live-update.
  // Reading Date.now() inside render breaks the react-hooks/purity rule.
  const [todayMs] = useState<number>(() => Date.now());

  const bred = new Date(breedingDate);
  if (Number.isNaN(bred.getTime())) return null;

  const due = new Date(bred);
  due.setDate(due.getDate() + 340);

  const milestones = [
    { label: "Bred", offsetDays: 0 },
    { label: "14-day check", offsetDays: 14 },
    { label: "30-day check", offsetDays: 30 },
    { label: "60-day check", offsetDays: 60 },
    { label: "Due", offsetDays: 340 },
  ];

  const spanMs = due.getTime() - bred.getTime();
  const todayInRange = todayMs >= bred.getTime() && todayMs <= due.getTime();
  const todayPct = todayInRange
    ? ((todayMs - bred.getTime()) / spanMs) * 100
    : null;

  return (
    <div>
      <div
        className="text-xs mb-2"
        style={{ color: "rgba(42,64,49,0.6)" }}
      >
        {mareName.trim() || "Your mare"}&apos;s timeline
      </div>
      <div style={{ position: "relative", padding: "24px 8px 40px" }}>
        {/* Baseline */}
        <div
          style={{
            position: "relative",
            height: 4,
            background: "rgba(42,64,49,0.1)",
            borderRadius: 2,
          }}
        >
          {/* Today marker */}
          {todayPct !== null && (
            <div
              style={{
                position: "absolute",
                left: `${todayPct}%`,
                top: -10,
                transform: "translateX(-50%)",
                width: 2,
                height: 24,
                background: "#c9a84c",
                borderRadius: 1,
              }}
              aria-label="Today"
            />
          )}
          {milestones.map((m) => {
            const pct = (m.offsetDays / 340) * 100;
            const date = new Date(bred);
            date.setDate(date.getDate() + m.offsetDays);
            return (
              <div
                key={m.label}
                style={{
                  position: "absolute",
                  left: `${pct}%`,
                  top: -6,
                  transform: "translateX(-50%)",
                }}
              >
                <div
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 7,
                    background: "#2a4031",
                    border: "2px solid white",
                  }}
                  aria-hidden="true"
                />
                <div
                  style={{
                    marginTop: 8,
                    width: 80,
                    marginLeft: -40,
                    textAlign: "center",
                    fontSize: 10,
                    fontWeight: 500,
                    color: "#2a4031",
                    lineHeight: 1.3,
                  }}
                >
                  <div>{m.label}</div>
                  <div style={{ color: "rgba(42,64,49,0.55)" }}>
                    {date.toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {todayPct !== null && (
          <div
            className="text-[11px]"
            style={{
              position: "absolute",
              left: `${todayPct}%`,
              top: 0,
              transform: "translateX(-50%)",
              color: "#c9a84c",
              fontWeight: 600,
            }}
          >
            Today
          </div>
        )}
      </div>
    </div>
  );
}
