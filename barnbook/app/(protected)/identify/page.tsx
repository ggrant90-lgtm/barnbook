"use client";

import dynamic from "next/dynamic";

const QRScanner = dynamic(
  () => import("@/components/QRScanner").then((m) => m.QRScanner),
  { ssr: false },
);

export default function IdentifyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="font-serif text-3xl font-semibold text-barn-dark">
        Identify
      </h1>
      <p className="mt-2 mb-6 text-barn-dark/70">
        Scan a horse&apos;s BarnBook QR code to pull up their profile instantly.
      </p>

      <QRScanner />
    </div>
  );
}
