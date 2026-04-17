"use client";

import Link from "next/link";
import { BreedersProChrome } from "@/components/breeders-pro/BreedersProChrome";

/* --------------------------------------------------------------------
 * Breeding Hub — method selection screen.
 *
 * Three cards: Flush (ET), Traditional Carry (live cover + AI), ICSI/OPU.
 * Each routes to the appropriate form. Simple, scannable, mobile-friendly.
 * ------------------------------------------------------------------ */

const breadcrumb = [
  { label: "Breeders Pro", href: "/breeders-pro" },
  { label: "New Breeding Event" },
];

const methods = [
  {
    key: "flush",
    title: "Flush",
    subtitle: "Embryo Transfer Program",
    description:
      "Record a flush on a donor mare, create embryos, and track them through transfer to a recipient mare.",
    href: "/breeders-pro/flush/new",
    enabled: true,
    icon: (
      <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 28, height: 28 }}>
        <ellipse cx="16" cy="16" rx="8" ry="12" />
        <line x1="16" y1="4" x2="16" y2="28" />
        <line x1="8" y1="16" x2="24" y2="16" />
      </svg>
    ),
  },
  {
    key: "live-cover",
    title: "Traditional Carry",
    subtitle: "Live Cover & Artificial Insemination",
    description:
      "Record a live cover or AI breeding. The mare carries her own foal — no embryos, no flush, no transfer.",
    href: "/breeders-pro/live-cover/new",
    enabled: true,
    icon: (
      <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 28, height: 28 }}>
        <circle cx="16" cy="16" r="12" />
        <path d="M11 16 Q16 20 21 16" />
        <circle cx="16" cy="11" r="2" />
      </svg>
    ),
  },
  {
    key: "icsi",
    title: "ICSI / OPU",
    subtitle: "Oocyte Recovery + Lab Fertilization",
    description:
      "Aspirate oocytes from a donor mare, send to an ICSI lab, and track individual oocyte-to-embryo development.",
    href: "/breeders-pro/opu/new",
    enabled: true,
    icon: (
      <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 28, height: 28 }}>
        <circle cx="16" cy="16" r="10" />
        <circle cx="16" cy="16" r="4" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="16" y1="26" x2="16" y2="30" />
        <line x1="2" y1="16" x2="6" y2="16" />
        <line x1="26" y1="16" x2="30" y2="16" />
      </svg>
    ),
  },
] as const;

export function BreedingHubClient() {
  return (
    <BreedersProChrome breadcrumb={breadcrumb}>
      <div className="bp-page-header">
        <h1 className="bp-display" style={{ fontSize: 32 }}>
          New Breeding Event
        </h1>
        <p
          style={{
            color: "var(--bp-ink-secondary)",
            fontSize: 13,
            marginTop: 6,
          }}
        >
          Select the breeding method to begin recording.
        </p>
      </div>

      <div
        className="px-4 md:px-8 pb-12"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          maxWidth: 800,
        }}
      >
        {methods.map((m) => {
          const card = (
            <div
              key={m.key}
              className="bp-breeding-card"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                padding: "24px 20px",
                border: `1px solid ${m.enabled ? "var(--bp-border-strong)" : "var(--bp-border)"}`,
                borderRadius: 6,
                background: "var(--bp-bg-elevated)",
                cursor: m.enabled ? "pointer" : "default",
                opacity: m.enabled ? 1 : 0.5,
                transition: "border-color 120ms, box-shadow 120ms",
                position: "relative" as const,
              }}
              onMouseEnter={(e) => {
                if (m.enabled) {
                  e.currentTarget.style.borderColor = "var(--bp-accent)";
                  e.currentTarget.style.boxShadow =
                    "0 2px 8px rgba(45, 95, 79, 0.1)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = m.enabled
                  ? "var(--bp-border-strong)"
                  : "var(--bp-border)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div
                style={{
                  color: m.enabled
                    ? "var(--bp-accent)"
                    : "var(--bp-ink-quaternary)",
                }}
              >
                {m.icon}
              </div>
              <div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    color: "var(--bp-ink)",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  {m.title}
                  {!m.enabled && (
                    <span className="bp-method-soon">soon</span>
                  )}
                </div>
                <div
                  className="bp-mono"
                  style={{
                    fontSize: 10,
                    color: "var(--bp-ink-tertiary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginTop: 2,
                  }}
                >
                  {m.subtitle}
                </div>
              </div>
              <p
                style={{
                  fontSize: 12,
                  color: "var(--bp-ink-secondary)",
                  lineHeight: 1.5,
                  margin: 0,
                }}
              >
                {m.description}
              </p>
              {m.enabled && (
                <div
                  className="bp-mono"
                  style={{
                    fontSize: 11,
                    color: "var(--bp-accent)",
                    marginTop: "auto",
                    fontWeight: 500,
                  }}
                >
                  Start →
                </div>
              )}
            </div>
          );

          if (m.enabled) {
            return (
              <Link
                key={m.key}
                href={m.href}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                {card}
              </Link>
            );
          }
          return card;
        })}
      </div>
    </BreedersProChrome>
  );
}
