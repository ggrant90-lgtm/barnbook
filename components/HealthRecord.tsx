import { formatDateShort } from "@/lib/format-date";
import { getHealthSummary } from "@/lib/horse-display";
import type { HealthRecord as HealthRecordModel } from "@/lib/types";

export type HealthRecordProps = {
  record: HealthRecordModel;
  loggerName?: string | null;
  loggerBarn?: string | null;
  onClick?: () => void;
};

/** Single health record row (shoeing, worming, vet, etc.). */
export function HealthRecordItem({ record: h, loggerName, loggerBarn, onClick }: HealthRecordProps) {
  return (
    <li
      className={`py-3 ${
        onClick ? "cursor-pointer rounded-lg px-2 -mx-2 transition hover:bg-parchment/60" : ""
      }`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="inline-block rounded-full bg-brass-gold/15 px-2 py-0.5 text-[10px] font-medium text-barn-dark/70">
              {h.record_type}
            </span>
          </div>
          <p className="mt-1 text-sm text-barn-dark/65">{getHealthSummary(h)}</p>
          {h.provider_name ? <p className="text-xs text-barn-dark/50">{h.provider_name}</p> : null}
          {loggerName ? (
            <p className="mt-0.5 text-[10px] text-barn-dark/40">
              {loggerName}{loggerBarn ? ` · ${loggerBarn}` : ""}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <p className="text-xs text-barn-dark/45">{formatDateShort(h.record_date)}</p>
          {onClick ? (
            <svg className="h-4 w-4 text-barn-dark/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          ) : null}
        </div>
      </div>
    </li>
  );
}
