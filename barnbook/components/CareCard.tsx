import { formatDateShort } from "@/lib/format-date";
import type { HealthRecord, Horse } from "@/lib/types";

interface CareCardProps {
  horse: Pick<
    Horse,
    "name" | "breed" | "photo_url" | "feed_regimen" | "supplements" | "special_care_notes" | "turnout_schedule"
  >;
  lastShoeing?: HealthRecord | null;
  lastWorming?: HealthRecord | null;
  /** When true, renders as a standalone public page (no outer card wrapper needed) */
  standalone?: boolean;
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5 py-2">
      <dt className="text-xs font-semibold uppercase tracking-wide text-barn-dark/45">
        {label}
      </dt>
      <dd className="whitespace-pre-line text-sm text-barn-dark/85">{value}</dd>
    </div>
  );
}

export function CareCard({ horse, lastShoeing, lastWorming, standalone }: CareCardProps) {
  const hasAnyData =
    horse.feed_regimen ||
    horse.supplements ||
    horse.special_care_notes ||
    horse.turnout_schedule ||
    lastShoeing ||
    lastWorming;

  if (!hasAnyData && !standalone) return null;

  const shoeingDetails = lastShoeing?.details as Record<string, unknown> | null;
  const shoeingDate = lastShoeing?.record_date
    ? formatDateShort(lastShoeing.record_date)
    : null;
  const shoeingCycle = shoeingDetails?.cycle_weeks
    ? `${shoeingDetails.cycle_weeks}-week cycle`
    : null;
  const shoeingSummary = [shoeingDate, shoeingCycle].filter(Boolean).join(" — ");

  const wormingDetails = lastWorming?.details as Record<string, unknown> | null;
  const wormingDate = lastWorming?.record_date
    ? formatDateShort(lastWorming.record_date)
    : null;
  const wormingProduct = wormingDetails?.product
    ? String(wormingDetails.product)
    : lastWorming?.description || null;
  const wormingSummary = [wormingDate, wormingProduct].filter(Boolean).join(" — ");

  const cardClasses = standalone
    ? ""
    : "rounded-2xl border border-barn-dark/10 bg-parchment/60 p-5 shadow-sm sm:p-6";

  return (
    <section className={cardClasses}>
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brass-gold/15">
          <svg
            className="h-4 w-4 text-brass-gold"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <h2 className="font-serif text-lg text-barn-dark">Care Summary</h2>
      </div>

      {!hasAnyData ? (
        <p className="text-sm text-barn-dark/50">
          No care info yet. Add feed, supplements, and notes from the Overview tab.
        </p>
      ) : (
        <dl className="divide-y divide-barn-dark/8">
          <Row label="Feed regimen" value={horse.feed_regimen} />
          <Row label="Supplements" value={horse.supplements} />
          <Row label="Special care notes" value={horse.special_care_notes} />
          <Row label="Turnout schedule" value={horse.turnout_schedule} />
          <Row label="Last shoeing" value={shoeingSummary || null} />
          <Row label="Last worming" value={wormingSummary || null} />
        </dl>
      )}
    </section>
  );
}
