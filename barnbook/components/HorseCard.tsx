import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import type { Horse } from "@/lib/types";
import Link from "next/link";
import { HorsePhoto } from "./HorsePhoto";

export type HorseCardProps = {
  horse: Pick<Horse, "id" | "name" | "photo_url" | "breed" | "sex">;
  href: string;
  /** Shown next to name line — default "Active" */
  statusLabel?: string;
  /** Stay badge (e.g. "Visiting from X" or "At X") */
  badge?: string;
};

export function HorseCard({ horse, href, statusLabel = "Active", badge }: HorseCardProps) {
  return (
    <Link href={href} className="block transition hover:opacity-[0.98]">
      <Card padding="none" className="overflow-hidden transition hover:border-brass-gold/40">
        <HorsePhoto name={horse.name} photoUrl={horse.photo_url} />
        <div className="p-4">
          <p className="font-semibold text-barn-dark">{horse.name}</p>
          <p className="text-sm text-barn-dark/60">{horse.breed ?? "—"}</p>
          <p className="text-xs text-barn-dark/50">{horse.sex ?? "—"}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge variant="active">{statusLabel}</Badge>
            {badge ? (
              <Badge variant="pending">{badge}</Badge>
            ) : null}
          </div>
        </div>
      </Card>
    </Link>
  );
}
