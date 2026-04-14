"use client";

import { useActionState } from "react";
import { createProgramAction } from "@/app/(protected)/actions/program";

/**
 * Breeders Pro onboarding — shown to new users who have no barn yet.
 *
 * One field (program name), one button. Creates the barn, membership,
 * and redirects to /breeders-pro (the Embryo Bank). The user never
 * sees BarnBook chrome at any point.
 *
 * Renders its own full-viewport chrome (same visual language as
 * BreedersProChrome but without the sidebar nav, since there's
 * nothing to navigate to yet).
 */
export function BreedersProWelcome() {
  const [state, formAction, isPending] = useActionState(
    createProgramAction,
    null,
  );

  return (
    <div
      className="bp-scope"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "var(--bp-bg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        {/* Brand */}
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontFamily: "var(--bp-font-display)",
              fontSize: 28,
              fontWeight: 400,
              letterSpacing: "-0.02em",
              color: "var(--bp-ink)",
            }}
          >
            Breeders
            <span
              className="bp-mono"
              style={{
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--bp-accent)",
                marginLeft: 6,
                verticalAlign: "super",
              }}
            >
              PRO
            </span>
          </div>
          <p
            style={{
              marginTop: 8,
              fontSize: 13,
              color: "var(--bp-ink-secondary)",
              lineHeight: 1.5,
            }}
          >
            Professional reproductive management for serious breeding programs.
            Create your program to get started.
          </p>
        </div>

        {/* Form */}
        <form
          action={formAction}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            padding: 24,
            border: "1px solid var(--bp-border)",
            borderRadius: 6,
            background: "var(--bp-bg-elevated)",
          }}
        >
          {state?.error && (
            <div
              style={{
                padding: "8px 12px",
                background: "#fef2f2",
                border: "1px solid #fca5a5",
                borderRadius: 4,
                color: "#991b1b",
                fontSize: 12,
              }}
            >
              {state.error}
            </div>
          )}

          <div>
            <label
              className="bp-field-label"
              htmlFor="program-name"
              style={{ display: "block", marginBottom: 6 }}
            >
              Program Name
            </label>
            <input
              id="program-name"
              name="name"
              type="text"
              required
              className="bp-input"
              placeholder="e.g. Grant Breeding Program"
              autoFocus
              style={{ width: "100%" }}
            />
            <p
              style={{
                marginTop: 6,
                fontSize: 11,
                color: "var(--bp-ink-tertiary)",
              }}
            >
              You can change this later in settings.
            </p>
          </div>

          <button
            type="submit"
            className="bp-btn bp-primary"
            disabled={isPending}
            style={{ width: "100%", justifyContent: "center" }}
          >
            {isPending ? "Creating…" : "Create Program →"}
          </button>
        </form>

        <p
          style={{
            textAlign: "center",
            fontSize: 10,
            color: "var(--bp-ink-quaternary)",
            fontFamily: "var(--bp-font-mono)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Embryo transfer · Traditional carry · ICSI / OPU
        </p>
      </div>
    </div>
  );
}
