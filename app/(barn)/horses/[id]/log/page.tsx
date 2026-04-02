"use client";

import { useHorseName } from "@/hooks/useHorseName";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function HorseLogHubPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const { name, loading } = useHorseName(id);

  if (!id) {
    return (
      <div className="min-h-full bg-parchment px-4 py-16 text-center text-oak">
        Invalid link.
      </div>
    );
  }

  return (
    <div className="min-h-full bg-parchment pb-8">
      <div className="border-b border-border-warm bg-cream px-4 py-3 sm:px-6">
        <Link
          href={`/horses/${id}`}
          className="text-sm font-semibold text-brass hover:text-brass-light"
        >
          ← Profile
        </Link>
      </div>

      <main className="mx-auto max-w-lg px-4 pt-6 sm:px-6">
        <p className="text-center text-xs font-medium uppercase tracking-wider text-brass">
          Log entry
        </p>
        <h1 className="mt-2 text-center text-2xl font-bold tracking-tight text-barn-dark">
          {loading ? "Loading…" : name ?? "Horse"}
        </h1>
        <p className="mt-2 text-center text-sm text-oak">
          What would you like to record?
        </p>

        <ul className="mt-10 flex flex-col gap-4">
          <li>
            <Link
              href={`/horses/${id}/log/exercise`}
              className="flex min-h-[5.5rem] items-center gap-5 rounded-2xl border-2 border-border-warm bg-cream p-5 shadow-sm transition active:scale-[0.99] hover:border-brass/40 hover:bg-parchment"
            >
              <span
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-brass/15 text-barn-dark"
                aria-hidden
              >
                <svg
                  className="h-9 w-9"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
                  />
                </svg>
              </span>
              <span className="text-left">
                <span className="block text-lg font-semibold text-barn-dark">
                  Exercise
                </span>
                <span className="mt-0.5 block text-sm text-oak">
                  Gallops, breezes, jogs, walks, and more
                </span>
              </span>
            </Link>
          </li>

          <li>
            <Link
              href={`/horses/${id}/log/shoeing`}
              className="flex min-h-[5.5rem] items-center gap-5 rounded-2xl border-2 border-border-warm bg-cream p-5 shadow-sm transition active:scale-[0.99] hover:border-brass/40 hover:bg-parchment"
            >
              <span
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-brass/15 text-barn-dark"
                aria-hidden
              >
                <svg
                  className="h-9 w-9"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5.5 9.5c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5v4a1.5 1.5 0 01-1.5 1.5h-10A1.5 1.5 0 015 13.5v-4z"
                  />
                  <path strokeLinecap="round" d="M9 14v2M15 14v2" />
                </svg>
              </span>
              <span className="text-left">
                <span className="block text-lg font-semibold text-barn-dark">
                  Shoeing
                </span>
                <span className="mt-0.5 block text-sm text-oak">
                  Farrier visits, resets, trims
                </span>
              </span>
            </Link>
          </li>

          <li>
            <Link
              href={`/horses/${id}/log/worming`}
              className="flex min-h-[5.5rem] items-center gap-5 rounded-2xl border-2 border-border-warm bg-cream p-5 shadow-sm transition active:scale-[0.99] hover:border-brass/40 hover:bg-parchment"
            >
              <span
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-brass/15 text-barn-dark"
                aria-hidden
              >
                <svg
                  className="h-9 w-9"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5"
                  />
                </svg>
              </span>
              <span className="text-left">
                <span className="block text-lg font-semibold text-barn-dark">
                  Worming
                </span>
                <span className="mt-0.5 block text-sm text-oak">
                  Deworming treatments and schedules
                </span>
              </span>
            </Link>
          </li>
        </ul>
      </main>
    </div>
  );
}
