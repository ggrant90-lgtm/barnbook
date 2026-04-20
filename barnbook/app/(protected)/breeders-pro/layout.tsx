import { redirect } from "next/navigation";
import { createServerComponentClient } from "@/lib/supabase-server";
import { getActiveBarnContext } from "@/lib/barn-session";
import { BreedersProSessionProvider } from "@/components/breeders-pro/BreedersProSession";
import { ModuleGate } from "@/components/modules/ModuleGate";

const BREEDERS_PRO_DESCRIPTION =
  "A premium breeding management tool for professional equine operations. Track embryos, manage donor mares, stallions, surrogates, and OPU/ICSI pipelines end-to-end.";

/**
 * Breeders Pro nested layout.
 *
 * Access gating is delegated to <ModuleGate module="breeders_pro">:
 * admin flag OR active subscription OR active trial all grant access.
 * Expired trials render children behind a grey-out so users can still
 * see their data.
 */
export default async function BreedersProLayout({
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

  const ctx = await getActiveBarnContext(supabase, user.id);
  const barnName = ctx?.barn?.name ?? "No Barn";

  const initials =
    displayName
      .split(/\s+/)
      .map((s) => s[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U";

  const barnLabel = `${barnName} · ${new Date().getFullYear()}`;

  return (
    <ModuleGate module="breeders_pro" description={BREEDERS_PRO_DESCRIPTION}>
      <BreedersProSessionProvider
        session={{
          userName: displayName,
          userInitials: initials,
          userRole: "Program Director",
          barnLabel,
        }}
      >
        {children}
      </BreedersProSessionProvider>
    </ModuleGate>
  );
}
