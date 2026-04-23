"use client";

import Image from "next/image";
import Link from "next/link";

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-parchment px-6 text-center">
      <Image
        src="/logo.png"
        alt="BarnBook"
        width={120}
        height={120}
        className="mb-8 opacity-80"
      />

      <h1 className="font-serif text-2xl font-semibold text-barn-dark">
        You&apos;re offline
      </h1>

      <p className="mt-3 max-w-sm text-barn-dark/60 leading-relaxed">
        It looks like your connection dropped. Some pages you&apos;ve visited
        recently are still available, but new content needs an internet
        connection.
      </p>

      <div className="mt-8 flex flex-col gap-3">
        <Link
          href="/dashboard"
          className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-brass-gold px-6 py-3 font-medium text-barn-dark shadow hover:brightness-110 transition"
        >
          Go to Dashboard
        </Link>

        <button
          onClick={() => window.location.reload()}
          className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-barn-dark/15 bg-white px-6 py-3 text-sm text-barn-dark/70 hover:border-barn-dark/30 transition"
        >
          Try again
        </button>
      </div>

      <p className="mt-12 text-xs text-barn-dark/30">
        BarnBook works best with an internet connection.
        <br />
        Check your Wi-Fi or cellular signal and try again.
      </p>
    </div>
  );
}
