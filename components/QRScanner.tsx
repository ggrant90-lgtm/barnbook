"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Html5Qrcode } from "html5-qrcode";

type ScanState = "idle" | "scanning" | "found" | "not_found" | "error";

export function QRScanner() {
  const router = useRouter();
  const [state, setState] = useState<ScanState>("idle");
  const [message, setMessage] = useState("");
  const [horseName, setHorseName] = useState("");
  const [horseId, setHorseId] = useState("");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const s = scannerRef.current;
        scannerRef.current = null;
        await s.stop();
        s.clear();
      } catch {
        // ignore cleanup errors
      }
    }
  }, []);

  const lookupHorse = useCallback(
    async (url: string) => {
      await stopScanner();
      setState("found");
      setMessage("Checking...");

      // Extract horse ID from URL patterns:
      // /care/{id}, /horses/{id}, or just a UUID
      let extractedId: string | null = null;

      try {
        const parsed = new URL(url);
        const pathParts = parsed.pathname.split("/").filter(Boolean);

        if (pathParts[0] === "care" && pathParts[1]) {
          extractedId = pathParts[1];
        } else if (pathParts[0] === "horses" && pathParts[1]) {
          extractedId = pathParts[1];
        }
      } catch {
        // Not a URL — check if it's a raw UUID
        const uuidMatch = url.match(
          /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
        );
        if (uuidMatch) {
          extractedId = uuidMatch[0];
        }
      }

      if (!extractedId) {
        setState("not_found");
        setMessage("This QR code isn't linked to a BarnBook horse.");
        return;
      }

      // Look up horse in database
      try {
        const res = await fetch(`/api/horse-lookup?id=${extractedId}`);
        if (res.ok) {
          const data = await res.json();
          setHorseName(data.name);
          setHorseId(extractedId);
          setState("found");
          setMessage(`Found: ${data.name}`);
        } else {
          setState("not_found");
          setMessage("This QR code isn't linked to a BarnBook horse.");
        }
      } catch {
        setState("error");
        setMessage("Could not connect. Check your internet.");
      }
    },
    [stopScanner],
  );

  const startScanner = useCallback(async () => {
    setState("scanning");
    setMessage("");
    setHorseName("");
    setHorseId("");

    // Small delay to ensure the DOM element is mounted
    await new Promise((r) => setTimeout(r, 100));

    try {
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1,
        },
        (decodedText) => {
          lookupHorse(decodedText);
        },
        () => {
          // ignore scan failures (no QR in frame)
        },
      );
    } catch (err) {
      setState("error");
      setMessage(
        "Camera access denied. Please allow camera access in your browser settings.",
      );
    }
  }, [lookupHorse]);

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [stopScanner]);

  return (
    <div className="flex flex-col items-center">
      {/* Scanner viewport */}
      <div
        ref={containerRef}
        className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-barn-dark/10 bg-black"
        style={{ minHeight: state === "scanning" ? 350 : 200 }}
      >
        <div id="qr-reader" className="w-full" />

        {state === "idle" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-barn-dark/90 p-6 text-center">
            <svg
              className="h-16 w-16 text-brass-gold"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5Z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6.75 6.75h.75v.75h-.75v-.75ZM6.75 16.5h.75v.75h-.75v-.75ZM16.5 6.75h.75v.75H16.5v-.75ZM13.5 13.5h.75v.75h-.75v-.75ZM13.5 19.5h.75v.75h-.75v-.75ZM19.5 13.5h.75v.75h-.75v-.75ZM19.5 19.5h.75v.75h-.75v-.75ZM16.5 16.5h.75v.75H16.5v-.75Z"
              />
            </svg>
            <p className="text-sm text-cream/70">
              Scan a BarnBook QR code to pull up a horse&apos;s profile
            </p>
          </div>
        )}

        {state === "found" && horseName && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-forest/95 p-6 text-center">
            <svg
              className="h-12 w-12 text-brass-gold"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
              />
            </svg>
            <p className="font-serif text-xl font-semibold text-cream">
              {horseName}
            </p>
          </div>
        )}

        {(state === "not_found" || state === "error") && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-barn-dark/95 p-6 text-center">
            <svg
              className="h-12 w-12 text-red-400"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
              />
            </svg>
            <p className="text-sm text-cream/70">{message}</p>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="mt-5 flex w-full max-w-sm flex-col gap-3">
        {state === "idle" && (
          <button
            type="button"
            onClick={startScanner}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-brass-gold px-4 py-3 font-medium text-barn-dark shadow hover:brightness-110 transition"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z"
              />
            </svg>
            Open Camera
          </button>
        )}

        {state === "scanning" && (
          <button
            type="button"
            onClick={async () => {
              await stopScanner();
              setState("idle");
            }}
            className="flex min-h-[48px] w-full items-center justify-center rounded-xl border border-barn-dark/15 bg-white px-4 py-3 text-sm text-barn-dark/70 hover:border-barn-dark/30 transition"
          >
            Cancel
          </button>
        )}

        {state === "found" && horseId && (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => router.push(`/horses/${horseId}`)}
              className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-brass-gold px-4 py-3 font-medium text-barn-dark shadow hover:brightness-110 transition"
            >
              View Profile
            </button>
            <button
              type="button"
              onClick={() => router.push(`/care/${horseId}`)}
              className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl border border-barn-dark/15 bg-white px-4 py-3 text-sm font-medium text-barn-dark hover:border-barn-dark/30 transition"
            >
              Care Card
            </button>
          </div>
        )}

        {(state === "not_found" || state === "error") && (
          <button
            type="button"
            onClick={() => {
              setState("idle");
              setMessage("");
            }}
            className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-brass-gold px-4 py-3 font-medium text-barn-dark shadow hover:brightness-110 transition"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}
