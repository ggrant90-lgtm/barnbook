"use client";

import { useBarn } from "@/components/BarnContext";
import { EquiTrackBrand } from "@/components/EquiTrackBrand";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

function HorseRowThumb({
  name,
  photoUrl,
}: {
  name: string;
  photoUrl: string | null;
}) {
  const letter = name.trim().charAt(0).toUpperCase() || "?";
  if (photoUrl) {
    return (
      <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full ring-1 ring-border-dark">
        <Image
          src={photoUrl}
          alt=""
          width={32}
          height={32}
          className="h-8 w-8 object-cover"
          unoptimized
        />
      </span>
    );
  }
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brass text-xs font-bold text-barn-dark">
      {letter}
    </span>
  );
}

function SidebarHorseList({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { horses, horsesLoading } = useBarn();

  const match = pathname?.match(/^\/horses\/([^/]+)/);
  const rawId = match?.[1];
  const selectedHorseId =
    rawId && rawId !== "new" ? rawId : null;

  if (horsesLoading) {
    return (
      <ul className="space-y-1 px-2 py-2" aria-busy="true" aria-label="Loading horses">
        {Array.from({ length: 8 }).map((_, i) => (
          <li key={i} className="animate-pulse rounded-lg px-3 py-3">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 shrink-0 rounded-full bg-saddle/40" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-32 max-w-full rounded bg-saddle/30" />
                <div className="h-3 w-40 max-w-full rounded bg-saddle/20" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  if (horses.length === 0) {
    return (
      <p className="px-4 py-6 text-center text-sm leading-relaxed text-oak">
        No horses yet. Add one to see them listed here.
      </p>
    );
  }

  return (
    <ul className="space-y-0.5 px-2 py-2">
      {horses.map((horse) => {
        const selected = selectedHorseId === horse.id;
        const sub = [horse.breed, horse.color].filter(Boolean).join(" · ");
        return (
          <li key={horse.id}>
            <Link
              href={`/horses/${horse.id}`}
              onClick={onNavigate}
              className={`flex min-h-[52px] items-center gap-3 rounded-lg px-3 py-2.5 transition ${
                selected
                  ? "border-l-[3px] border-brass bg-barn pl-[9px]"
                  : "border-l-[3px] border-transparent hover:bg-barn"
              }`}
            >
              <HorseRowThumb name={horse.name} photoUrl={horse.photo_url} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-leather">
                  {horse.name}
                </span>
                {sub ? (
                  <span className="mt-0.5 block truncate text-xs text-oak">
                    {sub}
                  </span>
                ) : (
                  <span className="mt-0.5 block text-xs text-oak/70">—</span>
                )}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function SidebarContent({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const { barnName, barnLoading } = useBarn();

  return (
    <div className="flex h-full min-h-0 flex-col bg-barn-dark">
      <div className="shrink-0 border-b border-border-dark px-4 pb-4 pt-5">
        <Link href="/" onClick={onNavigate} className="block">
          <EquiTrackBrand className="text-lg" />
        </Link>
        <p className="mt-2 text-sm font-medium text-oak">
          {barnLoading ? (
            <span className="inline-block h-4 w-32 animate-pulse rounded bg-saddle/50" />
          ) : (
            barnName ?? "Barn"
          )}
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <p className="px-4 pb-1 pt-4 text-xs font-semibold uppercase tracking-wider text-leather/80">
          Horses
        </p>
        <SidebarHorseList onNavigate={onNavigate} />
      </div>

      <div className="shrink-0 border-t border-border-dark p-3">
        <Link
          href="/horses/new"
          onClick={onNavigate}
          className="flex min-h-12 w-full items-center justify-center rounded-lg bg-brass text-sm font-semibold text-barn-dark shadow-sm transition hover:bg-brass-light"
        >
          + Add Horse
        </Link>
      </div>
    </div>
  );
}

export function BarnLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  return (
    <div className="flex min-h-screen bg-parchment">
      <aside
        className="hidden w-[280px] shrink-0 border-r border-border-dark md:flex md:flex-col"
        aria-label="Barn navigation"
      >
        <SidebarContent />
      </aside>

      {drawerOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
          />
          <aside
            id="mobile-drawer"
            className="fixed inset-y-0 left-0 z-50 flex w-[280px] max-w-[85vw] flex-col shadow-xl md:hidden"
          >
            <SidebarContent onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </>
      ) : null}

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border-dark bg-barn-dark px-4 py-3 md:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-border-dark text-leather hover:bg-barn"
            aria-expanded={drawerOpen}
            aria-controls="mobile-drawer"
            aria-label="Open menu"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
              />
            </svg>
          </button>
          <Link href="/" className="min-w-0">
            <EquiTrackBrand />
          </Link>
        </header>

        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
