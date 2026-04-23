import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createServerComponentClient } from "@/lib/supabase-server";
import {
  getModuleAccess,
  MODULE_LABEL,
  type ModuleId,
} from "@/lib/modules-query";
import { ModuleNoAccess } from "./ModuleNoAccess";
import { ModuleGreyOut } from "./ModuleGreyOut";
import { TrialBadge } from "./TrialBadge";
import { TrialNudgeBanner } from "./TrialNudgeBanner";

/**
 * Server wrapper that gates the premium module's entire route subtree.
 *
 * Outcomes for the current user:
 *   - Full access (subscription, admin flag, or active trial):
 *     renders children as-is, plus trial chrome (badge + ≤5-day banner)
 *     when the access came from a trial.
 *   - Trial expired: renders children AND a ModuleGreyOut overlay so
 *     the user sees their data through it. Data-count is computed here.
 *   - No trial ever: renders ModuleNoAccess (upsell + TrialActivationCard).
 *
 * Place at the TOP of each module's layout.tsx, wrapping the session
 * provider + children.
 */
export async function ModuleGate({
  module,
  description,
  children,
}: {
  module: ModuleId;
  description: string;
  children: ReactNode;
}) {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  // Cheap path first: check access without data counts.
  const initial = await getModuleAccess(supabase, user.id, module);

  // No trial ever + no other path in → show the upsell + TrialActivationCard.
  // (This is the "has never tried it" state. Trial expired is a different
  // branch below that still shows children underneath a grey-out.)
  if (!initial.hasAccess && !initial.trial) {
    return <ModuleNoAccess module={module} description={description} />;
  }

  // Trial expired and nothing else granting access → render children
  // behind a grey-out. The overlay needs data counts for the "what you
  // built" message, so do the heavier call only here.
  if (!initial.hasAccess && initial.trial?.expired) {
    const detailed = await getModuleAccess(supabase, user.id, module, {
      withDataCount: true,
    });
    return (
      <>
        {children}
        <ModuleGreyOut module={module} dataCount={detailed.dataCount} />
      </>
    );
  }

  // Has access. Decide whether to decorate with trial chrome.
  const showTrialChrome =
    initial.accessType === "trial" && initial.trial !== null;

  if (!showTrialChrome) {
    return <>{children}</>;
  }

  // Trial in progress. Badge always. Nudge banner appears at ≤5 days
  // (component decides its own visibility + dismissal).
  return (
    <>
      <ModuleTrialChrome
        module={module}
        daysLeft={initial.trial!.daysLeft}
      />
      {children}
    </>
  );
}

function ModuleTrialChrome({
  module,
  daysLeft,
}: {
  module: ModuleId;
  daysLeft: number;
}) {
  return (
    <div
      style={{
        padding: "10px 16px",
        borderBottom: "1px solid rgba(42,64,49,0.06)",
        background: "white",
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <div
        style={{ fontSize: 12, color: "rgba(42,64,49,0.55)", fontWeight: 500 }}
      >
        {MODULE_LABEL[module]}
      </div>
      <TrialBadge daysLeft={daysLeft} />
      <div style={{ flex: 1, minWidth: 12 }} />
      {daysLeft <= 5 && (
        <div style={{ width: "100%" }}>
          <TrialNudgeBanner module={module} daysLeft={daysLeft} />
        </div>
      )}
    </div>
  );
}
