import { redirect } from "next/navigation";
import { createServerComponentClient } from "@/lib/supabase-server";
import { getActiveBarnContext } from "@/lib/barn-session";
import { BreedersProSessionProvider } from "@/components/breeders-pro/BreedersProSession";

/**
 * Breeders Pro nested layout.
 *
 * Scope: presentation only. This layout reads the exact same auth helpers
 * already used elsewhere in the app (`createServerComponentClient`,
 * `getActiveBarnContext`) to derive session display strings for the sidebar
 * chrome. It does not add, modify, or write any data — it only formats
 * already-fetched session data for presentation.
 *
 * Each page in this subtree renders its own `<BreedersProChrome>` wrapper
 * with its own breadcrumb. Session data is passed down via context so the
 * work isn't duplicated per page.
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
    .select("full_name, has_breeders_pro")
    .eq("id", user.id)
    .maybeSingle();

  // ---- Subscription gate ----
  // Only the user with has_breeders_pro gets access.
  if (!profile?.has_breeders_pro) {
    redirect("/dashboard");
  }

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
  );
}
