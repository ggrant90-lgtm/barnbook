"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "barnbook_install_dismissed";
const DISMISS_DAYS = 7;

function isDismissed(): boolean {
  if (typeof window === "undefined") return true;
  const val = localStorage.getItem(DISMISS_KEY);
  if (!val) return false;
  const ts = parseInt(val, 10);
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts < DISMISS_DAYS * 24 * 60 * 60 * 1000;
}

function dismiss() {
  localStorage.setItem(DISMISS_KEY, String(Date.now()));
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSHint, setShowIOSHint] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Don't show if already installed or recently dismissed
    if (isStandalone() || isDismissed()) return;

    // Android/Chrome: capture beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    // iOS: show manual instructions
    if (isIOS()) {
      setShowIOSHint(true);
      setVisible(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setVisible(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    dismiss();
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="border-b border-barn-dark/10 bg-parchment px-4 py-2.5">
      <div className="mx-auto flex max-w-5xl items-center gap-3">
        <Image
          src="/icons/icon-192.png"
          alt=""
          width={32}
          height={32}
          className="shrink-0 rounded-lg"
        />

        <div className="min-w-0 flex-1">
          {showIOSHint ? (
            <p className="text-sm text-barn-dark/70">
              Install BarnBook: tap{" "}
              <svg className="inline h-4 w-4 align-text-bottom" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 0 0-2.25 2.25v9a2.25 2.25 0 0 0 2.25 2.25h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25H15m0-3-3-3m0 0-3 3m3-3V15" />
              </svg>{" "}
              then <strong>&quot;Add to Home Screen&quot;</strong>
            </p>
          ) : (
            <p className="text-sm text-barn-dark/70">
              Install BarnBook for quick access from your home screen
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!showIOSHint && deferredPrompt && (
            <button
              type="button"
              onClick={handleInstall}
              className="rounded-lg bg-brass-gold px-3 py-1.5 text-xs font-medium text-barn-dark shadow-sm hover:brightness-110 transition"
            >
              Install
            </button>
          )}
          <button
            type="button"
            onClick={handleDismiss}
            className="rounded-lg px-2 py-1.5 text-xs text-barn-dark/40 hover:text-barn-dark transition"
          >
            {showIOSHint ? "Got it" : "Not now"}
          </button>
        </div>
      </div>
    </div>
  );
}
