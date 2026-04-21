"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { Barn, Horse } from "@/lib/types";
import { ServiceBarnHorseCard } from "@/components/service-barn/ServiceBarnHorseCard";
import { LinkHorseModal } from "@/components/service-barn/LinkHorseModal";
import { QuickLogFab } from "@/components/service-barn/QuickLogFab";
import { QuickLogForm } from "@/components/service-barn/QuickLogForm";
import { BarnTypeIcon } from "@/components/BarnTypeIcon";
import { unlinkHorseFromServiceBarnAction } from "@/app/(protected)/actions/service-barn-links";

/**
 * Client dashboard for a Service Barn. Renders the unified list of
 * quick records + linked horses, the stats strip, search + filter +
 * sort controls, and mounts the quick-log FAB.
 */

export interface LinkedHorseProp {
  linkId: string;
  horse: Horse;
  owningBarnName: string;
  linkNotes: string | null;
}

type Filter = "all" | "quick" | "linked";
type Sort = "alpha" | "recent" | "outstanding";

export function ServiceBarnDashboard({
  barn,
  quickHorses,
  linkedHorses,
  stats,
}: {
  barn: Barn;
  quickHorses: Horse[];
  linkedHorses: LinkedHorseProp[];
  stats: {
    totalHorses: number;
    entriesThisWeek: number;
  };
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("alpha");
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [quickLogHorseId, setQuickLogHorseId] = useState<string | null>(null);

  const unifiedRows = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const quickRows =
      filter === "linked"
        ? []
        : quickHorses
            .filter((h) => {
              if (!ql) return true;
              const hay = [
                h.name,
                h.owner_contact_name,
                h.location_name,
              ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();
              return hay.includes(ql);
            })
            .map((h) => ({ kind: "quick" as const, horse: h }));

    const linkedRows =
      filter === "quick"
        ? []
        : linkedHorses
            .filter((lh) => {
              if (!ql) return true;
              const hay = [lh.horse.name, lh.owningBarnName]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();
              return hay.includes(ql);
            })
            .map((lh) => ({
              kind: "linked" as const,
              horse: lh.horse,
              owningBarnName: lh.owningBarnName,
              linkId: lh.linkId,
            }));

    const combined: Array<
      | { kind: "quick"; horse: Horse }
      | { kind: "linked"; horse: Horse; owningBarnName: string; linkId: string }
    > = [...quickRows, ...linkedRows];

    if (sort === "alpha") {
      combined.sort((a, b) =>
        a.horse.name.localeCompare(b.horse.name, undefined, { sensitivity: "base" }),
      );
    }
    // "recent" + "outstanding" sorts require extra data we haven't
    // fetched yet; falling back to alpha for now keeps the UI stable.
    return combined;
  }, [quickHorses, linkedHorses, q, filter, sort]);

  async function handleUnlink(linkId: string) {
    const ok = window.confirm(
      "Unlink this horse from your Service Barn? You'll keep your Stall Key access — it just won't appear here anymore.",
    );
    if (!ok) return;
    const res = await unlinkHorseFromServiceBarnAction(linkId);
    if (res.error) {
      window.alert(`Couldn't unlink: ${res.error}`);
      return;
    }
    router.refresh();
  }

  const fabHorseOptions = useMemo(
    () =>
      [
        ...quickHorses.map((h) => ({
          id: h.id,
          name: h.name,
          subtitle: h.location_name ?? h.owner_contact_name ?? "Quick record",
        })),
        ...linkedHorses.map((lh) => ({
          id: lh.horse.id,
          name: lh.horse.name,
          subtitle: `at ${lh.owningBarnName}`,
        })),
      ].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })),
    [quickHorses, linkedHorses],
  );

  const isEmpty = quickHorses.length + linkedHorses.length === 0;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <Link
        href="/dashboard"
        className="text-sm text-barn-dark/70 hover:text-brass-gold"
      >
        ← Dashboard
      </Link>
      <div className="mt-4 flex items-start gap-3 flex-wrap">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: "rgba(75,100,121,0.15)", color: "#4b6479" }}
        >
          <BarnTypeIcon type="service" size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-2xl font-semibold text-barn-dark truncate">
            {barn.name}
          </h1>
          <p className="text-sm text-barn-dark/60">
            Service Barn &middot; every horse you work on, in one place.
          </p>
        </div>
        <Link
          href={`/barn/${barn.id}/edit`}
          className="rounded-lg border px-3 py-1.5 text-xs font-medium text-barn-dark hover:bg-parchment"
          style={{ borderColor: "rgba(42,64,49,0.15)" }}
        >
          Edit
        </Link>
      </div>

      {/* Stats — slim inline row to minimize vertical real estate so
          the horse list starts higher on the page. */}
      <div
        className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 rounded-lg border bg-white px-3 py-2 text-sm"
        style={{ borderColor: "rgba(42,64,49,0.1)" }}
      >
        <StatInline label="Horses" value={stats.totalHorses.toString()} />
        <StatInline label="This week" value={stats.entriesThisWeek.toString()} />
        <StatInline
          label="Q / L"
          value={`${quickHorses.length} / ${linkedHorses.length}`}
          title={`${quickHorses.length} quick records · ${linkedHorses.length} linked horses`}
        />
      </div>

      {/* Quick actions */}
      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href={`/barn/${barn.id}/service/quick-record/new`}
          className="rounded-xl px-4 py-2 text-sm font-medium shadow"
          style={{ background: "#c9a84c", color: "#2a4031" }}
        >
          + Quick record
        </Link>
        <button
          type="button"
          onClick={() => setLinkModalOpen(true)}
          className="rounded-xl border px-4 py-2 text-sm font-medium text-barn-dark hover:bg-parchment"
          style={{ borderColor: "rgba(42,64,49,0.15)" }}
        >
          + Link from another barn
        </button>
      </div>

      {/* Search + filter */}
      {!isEmpty && (
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by horse, owner, or location"
            className="flex-1 rounded-xl border px-4 py-2.5 text-sm outline-none"
            style={{
              borderColor: "rgba(42,64,49,0.15)",
              color: "#2a4031",
              background: "white",
            }}
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as Filter)}
            className="rounded-xl border px-3 py-2.5 text-sm outline-none"
            style={{
              borderColor: "rgba(42,64,49,0.15)",
              color: "#2a4031",
              background: "white",
            }}
          >
            <option value="all">All</option>
            <option value="quick">Quick records</option>
            <option value="linked">Linked horses</option>
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="rounded-xl border px-3 py-2.5 text-sm outline-none"
            style={{
              borderColor: "rgba(42,64,49,0.15)",
              color: "#2a4031",
              background: "white",
            }}
          >
            <option value="alpha">A → Z</option>
            <option value="recent" disabled>
              Last visited (soon)
            </option>
            <option value="outstanding" disabled>
              Outstanding (soon)
            </option>
          </select>
        </div>
      )}

      {/* List */}
      {isEmpty ? (
        <div
          className="mt-8 rounded-2xl border bg-white p-10 text-center shadow-sm"
          style={{ borderColor: "rgba(42,64,49,0.1)" }}
        >
          <p className="font-serif text-lg text-barn-dark">
            Your Service Barn is empty.
          </p>
          <p className="mt-1 text-sm text-barn-dark/60">
            Add the horses you work on to start tracking your schedule and
            revenue.
          </p>
          <div className="mt-4 flex justify-center gap-2 flex-wrap">
            <Link
              href={`/barn/${barn.id}/service/quick-record/new`}
              className="rounded-xl px-4 py-2 text-sm font-medium shadow"
              style={{ background: "#c9a84c", color: "#2a4031" }}
            >
              Add a quick record
            </Link>
            <button
              type="button"
              onClick={() => setLinkModalOpen(true)}
              className="rounded-xl border px-4 py-2 text-sm font-medium text-barn-dark hover:bg-parchment"
              style={{ borderColor: "rgba(42,64,49,0.15)" }}
            >
              Link from another barn
            </button>
          </div>
        </div>
      ) : unifiedRows.length === 0 ? (
        <p className="mt-6 text-center text-sm text-barn-dark/60">
          No horses match your filters.
        </p>
      ) : (
        <ul className="mt-4 space-y-1.5">
          {unifiedRows.map((row) => (
            <li
              key={
                row.kind === "quick" ? `q-${row.horse.id}` : `l-${row.linkId}`
              }
            >
              <ServiceBarnHorseCard
                variant={row}
                onLog={(horseId) => setQuickLogHorseId(horseId)}
                onUnlink={row.kind === "linked" ? handleUnlink : undefined}
              />
            </li>
          ))}
        </ul>
      )}

      {/* FAB — fixed bottom-right, mobile-first thumb reachable. */}
      <QuickLogFab
        serviceBarnId={barn.id}
        horseOptions={fabHorseOptions}
      />

      {/* Per-card Log button opens the same QuickLogForm, pre-selected. */}
      {quickLogHorseId && (
        <QuickLogForm
          serviceBarnId={barn.id}
          horseOptions={fabHorseOptions}
          initialHorseId={quickLogHorseId}
          onClose={() => setQuickLogHorseId(null)}
        />
      )}

      {/* Link modal */}
      {linkModalOpen && (
        <LinkHorseModal
          serviceBarnId={barn.id}
          serviceBarnName={barn.name}
          alreadyLinkedHorseIds={linkedHorses.map((lh) => lh.horse.id)}
          onClose={() => setLinkModalOpen(false)}
        />
      )}
    </div>
  );
}

function StatInline({
  label,
  value,
  title,
}: {
  label: string;
  value: string;
  title?: string;
}) {
  return (
    <span title={title} className="inline-flex items-baseline gap-1">
      <span
        className="text-[11px] uppercase tracking-wide"
        style={{ color: "rgba(42,64,49,0.55)" }}
      >
        {label}
      </span>
      <span className="font-semibold text-barn-dark">{value}</span>
    </span>
  );
}
