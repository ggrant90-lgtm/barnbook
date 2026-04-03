import { formatDateShort } from "@/lib/format-date";
import { getHealthSummary } from "@/lib/horse-display";
import type { HealthRecord as HealthRecordModel } from "@/lib/types";

export type HealthRecordProps = {
  record: HealthRecordModel;
};

/** Single health record row (shoeing, worming, vet, etc.). */
export function HealthRecordItem({ record: h }: HealthRecordProps) {
  return (
    <li className="py-3">
      <p className="font-medium text-barn-dark">{h.record_type}</p>
      <p className="text-sm text-barn-dark/65">{getHealthSummary(h)}</p>
      {h.provider_name ? <p className="text-xs text-barn-dark/50">{h.provider_name}</p> : null}
      <p className="text-xs text-barn-dark/45">{formatDateShort(h.record_date)}</p>
    </li>
  );
}
