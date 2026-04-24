"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ScanModal, type ScanResult } from "@/components/document-scanner/ScanModal";
import { ReceiptScanModal } from "@/components/document-scanner/ReceiptScanModal";

const QRScanner = dynamic(
  () => import("@/components/QRScanner").then((m) => m.QRScanner),
  { ssr: false },
);

type Mode = "tiles" | "qr" | "document";

export function IdentifyLanding({
  hasDocumentScanner,
  activeBarnId,
  activeBarnName,
  writableBarns,
}: {
  hasDocumentScanner: boolean;
  activeBarnId: string | null;
  activeBarnName: string | null;
  /** Every barn the user can write to (owner or editor member).
   *  Used by the receipt-scan review step to let multi-barn users
   *  pick which barn the log posts to. */
  writableBarns: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("tiles");
  const [scanOpen, setScanOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);

  const handleScanComplete = (r: ScanResult) => {
    setScanOpen(false);
    if (r.kind === "attached" && r.horseId) {
      router.push(`/horses/${r.horseId}?tab=documents`);
    } else if (r.kind === "prefill" && r.prefill) {
      // Route to /horses/new and let the shell prefill. The pre-uploaded
      // file metadata rides along so NewHorseShell can attach the doc
      // to the freshly-created horse.
      try {
        sessionStorage.setItem(
          "barnbook:scan-prefill",
          JSON.stringify({
            extraction: r.prefill,
            uploadedDoc: r.uploadedDoc,
          }),
        );
      } catch {
        /* sessionStorage unavailable — user fills manually */
      }
      router.push("/horses/new");
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="font-serif text-3xl font-semibold text-barn-dark">
        Scan
      </h1>
      <p className="mt-2 mb-6 text-barn-dark/70">
        Pull up a horse by QR tag, or scan a document to import its info.
      </p>

      {mode === "tiles" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setMode("qr")}
            className="rounded-2xl border border-barn-dark/10 bg-white p-6 text-left hover:border-brass-gold transition"
          >
            <div className="text-3xl mb-2">🏷️</div>
            <div className="font-serif text-lg font-semibold text-barn-dark">
              Scan a QR tag
            </div>
            <div className="text-xs text-barn-dark/60 mt-1">
              Point your camera at a horse's BarnBook QR tag to open their
              profile.
            </div>
          </button>

          {hasDocumentScanner && activeBarnId ? (
            <button
              type="button"
              onClick={() => {
                setMode("document");
                setScanOpen(true);
              }}
              className="rounded-2xl border border-barn-dark/10 bg-white p-6 text-left hover:border-brass-gold transition"
            >
              <div className="text-3xl mb-2">📄</div>
              <div className="font-serif text-lg font-semibold text-barn-dark">
                Scan a document
              </div>
              <div className="text-xs text-barn-dark/60 mt-1">
                Photograph a coggins, registration, or health cert. BarnBook
                reads it and matches to the right horse.
              </div>
            </button>
          ) : (
            <div
              className="rounded-2xl border p-6 text-left"
              style={{
                borderStyle: "dashed",
                borderColor: "rgba(0,0,0,0.12)",
                background: "#fefdf8",
              }}
            >
              <div className="text-3xl mb-2 opacity-50">📄</div>
              <div className="font-serif text-lg font-semibold text-barn-dark/70">
                Scan a document
              </div>
              <div className="text-xs text-barn-dark/60 mt-1">
                Document scanning requires a paid plan or explicit access.{" "}
                <Link
                  href="/pricing"
                  className="underline hover:text-brass-gold"
                >
                  Learn more
                </Link>
                .
              </div>
            </div>
          )}

          {activeBarnId ? (
            <button
              type="button"
              onClick={() => setReceiptOpen(true)}
              className="rounded-2xl border border-barn-dark/10 bg-white p-6 text-left hover:border-brass-gold transition"
            >
              <div className="text-3xl mb-2">🧾</div>
              <div className="font-serif text-lg font-semibold text-barn-dark">
                Scan a receipt
              </div>
              <div className="text-xs text-barn-dark/60 mt-1">
                Photograph a receipt and BarnBook will pull the vendor,
                total, and line items into a barn log.
              </div>
            </button>
          ) : (
            <div
              className="rounded-2xl border p-6 text-left"
              style={{
                borderStyle: "dashed",
                borderColor: "rgba(0,0,0,0.12)",
                background: "#fefdf8",
              }}
            >
              <div className="text-3xl mb-2 opacity-50">🧾</div>
              <div className="font-serif text-lg font-semibold text-barn-dark/70">
                Scan a receipt
              </div>
              <div className="text-xs text-barn-dark/60 mt-1">
                Pick a barn first — receipts are logged against the
                active barn.
              </div>
            </div>
          )}
        </div>
      )}

      {mode === "qr" && (
        <>
          <button
            type="button"
            onClick={() => setMode("tiles")}
            className="mb-4 text-sm text-barn-dark/70 hover:text-barn-dark"
          >
            ← Back
          </button>
          <QRScanner />
        </>
      )}

      {activeBarnId && (
        <ScanModal
          open={scanOpen}
          onClose={() => {
            setScanOpen(false);
            setMode("tiles");
          }}
          barnId={activeBarnId}
          mode="dashboard"
          onComplete={handleScanComplete}
        />
      )}

      {activeBarnId && receiptOpen && (
        <ReceiptScanModal
          barnId={activeBarnId}
          barnName={activeBarnName ?? "Barn"}
          writableBarns={writableBarns}
          onClose={() => setReceiptOpen(false)}
        />
      )}
    </div>
  );
}
