"use client";

/**
 * Live preview of the horse profile being built in the Core wizard.
 * Reads from local wizard state; updates in real time as the user types
 * a name, picks a breed, attaches a photo, or logs a record.
 */
export function WizardHorsePreview({
  name,
  breed,
  foalDate,
  photoUrl,
  recordLabel,
}: {
  name: string;
  breed: string | null;
  foalDate: string | null;
  /** Object URL or remote URL. Falls back to a silhouette when null. */
  photoUrl: string | null;
  /** If set, rendered as a small "1 record" pill below the card. */
  recordLabel: string | null;
}) {
  const displayName = name.trim() || "Your horse";
  const dateLabel = foalDate ? fmtDate(foalDate) : null;

  return (
    <div
      className="rounded-2xl border bg-white shadow-sm overflow-hidden"
      style={{ borderColor: "rgba(42,64,49,0.1)" }}
    >
      <div
        style={{
          aspectRatio: "4 / 3",
          background: "rgba(163,184,143,0.2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <Silhouette />
        )}
      </div>
      <div style={{ padding: 14 }}>
        <div
          className="font-serif text-lg font-semibold"
          style={{ color: "#2a4031" }}
        >
          {displayName}
        </div>
        {(breed || dateLabel) && (
          <div
            className="text-xs mt-0.5"
            style={{ color: "rgba(42,64,49,0.6)" }}
          >
            {[breed, dateLabel].filter(Boolean).join(" · ")}
          </div>
        )}
        {recordLabel && (
          <div
            className="mt-3 inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium"
            style={{
              background: "rgba(163,184,143,0.3)",
              color: "#2a4031",
            }}
          >
            1 record · {recordLabel}
          </div>
        )}
      </div>
    </div>
  );
}

function Silhouette() {
  // Minimal horse-head silhouette used as the photo placeholder.
  return (
    <svg
      width="64"
      height="64"
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M18 46c0-11 6-20 16-20 4 0 6 2 6 2l4-8c1-2 3-2 4 0l3 6c3 6 0 14-4 18-5 5-11 6-15 6-10 0-14-2-14-4z"
        fill="rgba(42,64,49,0.35)"
      />
    </svg>
  );
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
