"use client";

import { useBarn } from "@/components/BarnContext";
import { HorsePhotoImg } from "@/components/HorsePhotoImg";
import { ageFromFoalDate } from "@/lib/horse-age";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function BarnDashboardPage() {
  const { barnName, barnLoading, horses, horsesLoading } = useBarn();
  const [recentActivityCount, setRecentActivityCount] = useState<number | null>(
    null,
  );
  const [activityLoading, setActivityLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (horsesLoading) return;
      if (horses.length === 0) {
        setRecentActivityCount(0);
        setActivityLoading(false);
        return;
      }

      setActivityLoading(true);
      const ids = horses.map((h) => h.id);
      const since = new Date();
      since.setDate(since.getDate() - 7);

      const { count, error } = await supabase
        .from("activity_log")
        .select("id", { count: "exact", head: true })
        .in("horse_id", ids)
        .gte("created_at", since.toISOString());

      if (cancelled) return;
      if (error) {
        setRecentActivityCount(null);
      } else {
        setRecentActivityCount(count ?? 0);
      }
      setActivityLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [horses, horsesLoading]);

  const totalHorses = horses.length;
  const loading = barnLoading || horsesLoading;

  return (
    <div className="min-h-full px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-bold tracking-tight text-barn-dark sm:text-3xl">
          {loading ? (
            <span className="inline-block h-9 w-64 animate-pulse rounded-lg bg-border-warm" />
          ) : (
            <>Welcome{barnName ? ` to ${barnName}` : ""}</>
          )}
        </h1>
        <p className="mt-2 text-sm text-oak sm:text-base">
          Your barn dashboard — horses, activity, and records in one place.
        </p>

        <p className="mt-4">
          <Link
            href="/identify"
            className="inline-flex items-center gap-2 text-sm font-semibold text-brass hover:text-brass-light"
          >
            Identify a horse (search all barns)
            <span aria-hidden>→</span>
          </Link>
        </p>

        <dl className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-border-warm bg-cream p-5 shadow-sm">
            <dt className="text-xs font-semibold uppercase tracking-wide text-oak">
              Total horses
            </dt>
            <dd className="mt-2 text-3xl font-bold tabular-nums text-barn-dark">
              {horsesLoading ? "—" : totalHorses}
            </dd>
          </div>
          <div className="rounded-2xl border border-border-warm bg-cream p-5 shadow-sm">
            <dt className="text-xs font-semibold uppercase tracking-wide text-oak">
              Activity entries (7 days)
            </dt>
            <dd className="mt-2 text-3xl font-bold tabular-nums text-barn-dark">
              {activityLoading || horsesLoading
                ? "—"
                : recentActivityCount ?? "—"}
            </dd>
          </div>
        </dl>

        {horsesLoading ? (
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-64 animate-pulse rounded-2xl border border-border-warm bg-cream"
              />
            ))}
          </div>
        ) : totalHorses === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-border-warm bg-cream px-6 py-14 text-center shadow-sm">
            <p className="text-lg font-semibold text-barn-dark">
              Add your first horse
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-oak">
              Build your roster to track workouts, shoeing, worming, and health
              in one place.
            </p>
            <Link
              href="/horses/new"
              className="mt-8 inline-flex min-h-12 items-center justify-center rounded-xl bg-brass px-8 text-base font-semibold text-barn-dark shadow-sm transition hover:bg-brass-light"
            >
              + Add Horse
            </Link>
          </div>
        ) : (
          <div className="mt-10">
            <h2 className="text-lg font-semibold text-barn-dark">Your horses</h2>
            <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {horses.map((horse) => {
                const sub = [horse.breed, horse.color]
                  .filter(Boolean)
                  .join(" · ");
                const letter =
                  horse.name.trim().charAt(0).toUpperCase() || "?";
                return (
                  <li key={horse.id}>
                    <Link
                      href={`/horses/${horse.id}`}
                      className="block overflow-hidden rounded-2xl border border-border-warm bg-cream shadow-sm transition hover:border-brass/40 hover:shadow-md"
                    >
                      <div className="relative aspect-[16/10] w-full bg-parchment">
                        {horse.photo_url ? (
                          <HorsePhotoImg
                            src={horse.photo_url}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <span className="text-4xl font-serif font-semibold text-oak/40">
                              {letter}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="p-5">
                        <p className="font-semibold text-barn-dark">{horse.name}</p>
                        {sub ? (
                          <p className="mt-1 text-sm text-oak">{sub}</p>
                        ) : null}
                        <p className="mt-3 text-xs font-medium uppercase tracking-wide text-oak">
                          Age
                        </p>
                        <p className="text-sm font-medium text-barn-dark">
                          {ageFromFoalDate(horse.foal_date)}
                        </p>
                        <p className="mt-4 text-sm font-semibold text-brass">
                          View profile →
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
