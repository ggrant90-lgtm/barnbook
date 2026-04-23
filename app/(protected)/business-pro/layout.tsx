import { redirect } from "next/navigation";
import { createServerComponentClient } from "@/lib/supabase-server";
import { BusinessProSessionProvider } from "@/components/business-pro/BusinessProSession";
import { ModuleGate } from "@/components/modules/ModuleGate";

const BUSINESS_PRO_DESCRIPTION =
  "A premium financial management add-on for BarnBook. Track revenue, expenses, and receivables across all your barns with a QuickBooks-style dashboard, AR aging, trend charts, and per-barn breakdowns.";

/**
 * Business Pro nested layout.
 *
 * Access gating is delegated to <ModuleGate module="business_pro">:
 * admin flag OR active subscription OR active trial all grant access.
 * Expired trials render children behind a grey-out so users can still
 * see their data.
 */
export default async function BusinessProLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const meta = user.user_metadata as { full_name?: string } | undefined;
  const displayName =
    profile?.full_name?.trim() ||
    meta?.full_name?.trim() ||
    user.email?.split("@")[0] ||
    "Member";

  const initials =
    displayName
      .split(/\s+/)
      .map((s) => s[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U";

  return (
    <ModuleGate module="business_pro" description={BUSINESS_PRO_DESCRIPTION}>
      <BusinessProSessionProvider
        session={{
          userName: displayName,
          userInitials: initials,
          userRole: "Business Pro",
        }}
      >
        {children}
      </BusinessProSessionProvider>
    </ModuleGate>
  );
}
