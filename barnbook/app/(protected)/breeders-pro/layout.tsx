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
    return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        padding: "48px 24px",
        textAlign: "center",
        maxWidth: 480,
        margin: "0 auto",
      }}>
        <div style={{
          fontSize: 48,
          marginBottom: 16,
          fontFamily: "var(--font-display, serif)",
        }}>
          Breeders Pro
        </div>
        <p style={{
          fontSize: 15,
          color: "#6b7280",
          lineHeight: 1.6,
          marginBottom: 24,
        }}>
          Breeders Pro is a premium breeding management tool for professional
          equine operations. Track embryos, manage donor mares, stallions,
          surrogates, OPU/ICSI pipelines, and more.
        </p>
        <p style={{
          fontSize: 14,
          color: "#374151",
        }}>
          For more information, please contact us at{" "}
          <a
            href="mailto:admin@barnbook.us"
            style={{ color: "#c9a84c", textDecoration: "underline" }}
          >
            admin@barnbook.us
          </a>
        </p>
      </div>
    );
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
