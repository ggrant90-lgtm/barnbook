"use client";

import { CapacityBar } from "@/components/CapacityBar";
import { HorseCard } from "@/components/HorseCard";
import { HorsePhoto } from "@/components/HorsePhoto";
import { PlanBadge } from "@/components/PlanBadge";
import { TodayWidget } from "@/components/TodayWidget";
import type { CalendarEvent } from "@/app/(protected)/actions/calendar";
import type { ActivityLog, Barn, Horse } from "@/lib/types";
import Link from "next/link";
import { useState } from "react";

function formatWhen(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString();
}

export function DashboardTabs({
  ownedBarns,
  accessBarns,
  accessBarnHorses,
  primaryBarn,
  horses,
  horseCount,
  activeKeys,
  pendingRequests,
  recentActivity,
  todayEvents,
  upcomingEvents,
}: {
  ownedBarns: Barn[];
  accessBarns: (Barn & { userRole: string })[];
  accessBarnHorses: Record<string, Pick<Horse, "id" | "name" | "breed" | "photo_url">[]>;
  primaryBarn: Barn | null;
  horses: Pick<Horse, "id" | "name" | "photo_url" | "breed" | "sex" | "color" | "updated_at">[];
  horseCount: number;
  activeKeys: number;
  pendingRequests: number;
  recentActivity: { log: ActivityLog; horseName: string }[];
  todayEvents?: CalendarEvent[];
  upcomingEvents?: CalendarEvent[];
}) {
  const [tab, setTab] = useState<"my" | "access">("my");

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {/* ─── Tab bar ─── */}
      <div className="flex items-center gap-1 rounded-xl bg-barn-dark/5 p-1">
        <button
          type="button"
          onClick={() => setTab("my")}
          className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
            tab === "my"
              ? "bg-white text-barn-dark shadow-sm"
              : "text-barn-dark/55 hover:text-barn-dark/80"
          }`}
        >
          <span className="flex items-center justify-center gap-2">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            My Barns
            {ownedBarns.length > 0 ? (
              <span className="rounded-full bg-brass-gold/20 px-1.5 py-0.5 text-xs text-barn-dark/70">
                {ownedBarns.length}
              </span>
            ) : null}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setTab("access")}
          className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
            tab === "access"
              ? "bg-white text-barn-dark shadow-sm"
              : "text-barn-dark/55 hover:text-barn-dark/80"
          }`}
        >
          <span className="flex items-center justify-center gap-2">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            Barn Access
            {accessBarns.length > 0 ? (
              <span className="rounded-full bg-barn-dark/10 px-1.5 py-0.5 text-xs text-barn-dark/55">
                {accessBarns.length}
              </span>
            ) : null}
          </span>
        </button>
      </div>

      {/* ═══ MY BARNS TAB ═══ */}
      {tab === "my" ? (
        <>
          {ownedBarns.length === 0 ? (
            <div className="mt-10 rounded-2xl border border-barn-dark/10 bg-white p-8 text-center shadow-sm">
              <p className="font-serif text-lg text-barn-dark">You haven&apos;t created a barn yet</p>
              <p className="mt-2 text-sm text-barn-dark/60">
                Create a barn to start managing horses, generating keys, and building your profile.
              </p>
              <Link
                href="/barn/new"
                className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-brass-gold px-6 py-2.5 font-medium text-barn-dark shadow hover:brightness-110"
              >
                Create Your Barn
              </Link>
            </div>
          ) : primaryBarn ? (
            <>
              <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="font-serif text-3xl font-semibold text-barn-dark">{primaryBarn.name}</h1>
                    <PlanBadge tier={primaryBarn.plan_tier} />
                  </div>
                  <p className="text-sm text-barn-dark/65">Barn dashboard</p>
                  <div className="mt-1 max-w-xs">
                    <CapacityBar stallCapacity={primaryBarn.stall_capacity} horseCount={horseCount} compact />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/barn/${primaryBarn.id}`}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-barn-dark/20 bg-white px-4 py-2.5 text-sm font-medium text-barn-dark hover:border-brass-gold"
                  >
                    View Profile
                  </Link>
                  <Link
                    href={`/barn/${primaryBarn.id}/edit`}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-brass-gold px-4 py-2.5 text-sm font-medium text-barn-dark shadow hover:brightness-110"
                  >
                    Edit Profile
                  </Link>
                </div>
              </div>

              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-barn-dark/10 bg-white p-5 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-barn-dark/50">Horses</p>
                  <p className="mt-1 font-serif text-3xl text-barn-dark">{horseCount}</p>
                </div>
                <div className="rounded-2xl border border-barn-dark/10 bg-white p-5 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-barn-dark/50">Active keys</p>
                  <p className="mt-1 font-serif text-3xl text-barn-dark">{activeKeys}</p>
                </div>
                <div className="rounded-2xl border border-barn-dark/10 bg-white p-5 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-barn-dark/50">Pending requests</p>
                  <p className="mt-1 font-serif text-3xl text-barn-dark">{pendingRequests}</p>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/horses/new"
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-brass-gold px-5 py-2.5 text-sm font-medium text-barn-dark shadow hover:brightness-110"
                >
                  Add Horse
                </Link>
                <Link
                  href="/keys"
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-barn-dark/20 bg-white px-5 py-2.5 text-sm font-medium text-barn-dark hover:border-brass-gold"
                >
                  Generate Key
                </Link>
                <Link
                  href="/keys/requests"
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-barn-dark/20 bg-white px-5 py-2.5 text-sm font-medium text-barn-dark hover:border-brass-gold"
                >
                  View Requests
                </Link>
              </div>

              <section className="mt-12">
                <h2 className="font-serif text-xl text-barn-dark">Horses</h2>
                {horses.length === 0 ? (
                  <p className="mt-3 text-barn-dark/70">No horses yet. Add your first horse to get started.</p>
                ) : (
                  <ul className="mt-4 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
                    {horses.map((h) => (
                      <li key={h.id}>
                        <HorseCard horse={h} href={`/horses/${h.id}`} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Today's Schedule */}
              {(todayEvents?.length || upcomingEvents?.length) ? (
                <section className="mt-8">
                  <TodayWidget today={todayEvents ?? []} upcoming={upcomingEvents ?? []} />
                </section>
              ) : null}

              <section className="mt-12">
                <h2 className="font-serif text-xl text-barn-dark">Recent activity</h2>
                {recentActivity.length === 0 ? (
                  <p className="mt-3 text-barn-dark/70">No activity log entries yet.</p>
                ) : (
                  <ul className="mt-4 divide-y divide-barn-dark/10 rounded-2xl border border-barn-dark/10 bg-white">
                    {recentActivity.map(({ log, horseName }) => (
                      <li key={log.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-medium text-barn-dark">{log.activity_type}</p>
                          <p className="text-sm text-barn-dark/65">{horseName}</p>
                        </div>
                        <time className="text-xs text-barn-dark/50" dateTime={log.created_at}>
                          {formatWhen(log.created_at)}
                        </time>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          ) : null}
        </>
      ) : null}

      {/* ═══ BARN ACCESS TAB ═══ */}
      {tab === "access" ? (
        <>
          <div className="mt-6">
            <h1 className="font-serif text-2xl font-semibold text-barn-dark">Barn Access</h1>
            <p className="mt-1 text-sm text-barn-dark/60">
              Barns you&apos;ve been given access to via keys or invites.
            </p>
          </div>

          {accessBarns.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-barn-dark/10 bg-white p-8 text-center shadow-sm">
              <svg className="mx-auto h-12 w-12 text-barn-dark/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              <p className="mt-4 font-serif text-lg text-barn-dark">
                No barn access yet
              </p>
              <p className="mt-2 text-sm text-barn-dark/60">
                Ask a barn owner for a Barn Key or Stall Key to get started.
              </p>
              <Link
                href="/join"
                className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-xl border-2 border-barn-dark/20 bg-white px-6 py-2.5 font-medium text-barn-dark hover:border-brass-gold"
              >
                I Have a Key
              </Link>
            </div>
          ) : (
            <div className="mt-6 space-y-6">
              {accessBarns.map((barn) => {
                const barnHorses = accessBarnHorses[barn.id] ?? [];
                return (
                  <div
                    key={barn.id}
                    className="rounded-2xl border border-barn-dark/10 bg-white shadow-sm overflow-hidden"
                  >
                    {/* Barn header */}
                    <div className="flex items-center gap-4 border-b border-barn-dark/5 bg-parchment/50 px-5 py-4">
                      {barn.logo_url ? (
                        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-barn-dark/10">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={barn.logo_url} alt="" className="h-full w-full object-cover" />
                        </div>
                      ) : (
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-barn-dark">
                          <span className="font-serif text-lg font-semibold text-brass-gold">
                            {barn.name.charAt(0)}
                          </span>
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <Link href={`/barn/${barn.id}`} className="font-serif text-lg font-semibold text-barn-dark hover:text-brass-gold">
                          {barn.name}
                        </Link>
                        <p className="text-xs capitalize text-barn-dark/55">
                          <span className="inline-flex items-center gap-1 rounded-full bg-brass-gold/15 px-2 py-0.5 text-xs font-medium text-barn-dark/70">
                            {barn.userRole}
                          </span>
                          {barn.city && barn.state ? (
                            <span className="ml-2 text-barn-dark/40">
                              {barn.city}, {barn.state}
                            </span>
                          ) : null}
                        </p>
                      </div>
                    </div>

                    {/* Horses in this barn */}
                    {barnHorses.length > 0 ? (
                      <div className="px-5 py-4">
                        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-barn-dark/45">
                          Horses ({barnHorses.length})
                        </p>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                          {barnHorses.slice(0, 8).map((h) => (
                            <Link
                              key={h.id}
                              href={`/horses/${h.id}`}
                              className="group flex items-center gap-2 rounded-xl border border-barn-dark/8 p-2 transition-all hover:border-brass-gold/30 hover:bg-parchment/30"
                            >
                              <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg">
                                <HorsePhoto
                                  name={h.name}
                                  photoUrl={h.photo_url}
                                  aspectClassName="aspect-square w-full"
                                  className="rounded-lg"
                                />
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-barn-dark">{h.name}</p>
                                {h.breed ? (
                                  <p className="truncate text-xs text-barn-dark/45">{h.breed}</p>
                                ) : null}
                              </div>
                            </Link>
                          ))}
                        </div>
                        {barnHorses.length > 8 ? (
                          <p className="mt-2 text-xs text-barn-dark/45">
                            +{barnHorses.length - 8} more
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <div className="px-5 py-4">
                        <p className="text-sm text-barn-dark/50">No horses in this barn yet.</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
