import { TrialActivationCard } from "./TrialActivationCard";
import {
  MODULE_LABEL,
  type ModuleId,
} from "@/lib/modules-query";

/**
 * Full-page no-access state for a premium module. Shown when a user has
 * never started a trial and doesn't have the admin flag or a
 * subscription.
 *
 * Layers: TrialActivationCard (primary CTA) + preserved Calendly walkthrough
 * link + email fallback. The trial is the new "front door"; the Calendly
 * path stays for users who want a guided tour first.
 */
export function ModuleNoAccess({
  module,
  description,
}: {
  module: ModuleId;
  description: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        padding: "48px 24px",
        textAlign: "center",
        maxWidth: 560,
        margin: "0 auto",
      }}
    >
      <div
        style={{
          fontSize: 36,
          fontWeight: 600,
          marginBottom: 8,
          fontFamily: "var(--font-display, serif)",
          color: "#2a4031",
        }}
      >
        {MODULE_LABEL[module]}
      </div>

      <TrialActivationCard module={module} description={description} />

      <p
        style={{
          fontSize: 13,
          color: "#6b7280",
          marginTop: 32,
        }}
      >
        Want a guided walkthrough first?{" "}
        <a
          href="https://calendly.com/ggrant90/30min"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#c9a84c", textDecoration: "underline" }}
        >
          Schedule 30 minutes
        </a>
        {" "}or email{" "}
        <a
          href="mailto:admin@barnbook.us"
          style={{ color: "#c9a84c", textDecoration: "underline" }}
        >
          admin@barnbook.us
        </a>
        .
      </p>
    </div>
  );
}
