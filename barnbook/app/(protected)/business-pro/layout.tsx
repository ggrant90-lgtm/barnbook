import { redirect } from "next/navigation";
import { createServerComponentClient } from "@/lib/supabase-server";
import { BusinessProSessionProvider } from "@/components/business-pro/BusinessProSession";

/**
 * Business Pro nested layout.
 *
 * Gates access based on `profiles.has_business_pro`. Non-subscribers see the
 * upsell card and a contact email. Subscribers proceed into the financial
 * dashboard and its child routes.
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
    .select("full_name, has_business_pro")
    .eq("id", user.id)
    .maybeSingle();

  // ---- Subscription gate ----
  if (!profile?.has_business_pro) {
    return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        padding: "48px 24px",
        textAlign: "center",
        maxWidth: 520,
        margin: "0 auto",
      }}>
        <div style={{
          fontSize: 48,
          marginBottom: 16,
          fontFamily: "var(--font-display, serif)",
        }}>
          Business Pro
        </div>
        <p style={{
          fontSize: 15,
          color: "#6b7280",
          lineHeight: 1.6,
          marginBottom: 24,
        }}>
          Business Pro is a premium financial management add-on for BarnBook.
          Track revenue, expenses, and receivables across all your barns with a
          QuickBooks-style dashboard, accounts receivable aging, trend charts,
          and per-barn breakdowns.
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

  const initials =
    displayName
      .split(/\s+/)
      .map((s) => s[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U";

  return (
    <BusinessProSessionProvider
      session={{
        userName: displayName,
        userInitials: initials,
        userRole: "Business Pro",
      }}
    >
      {children}
    </BusinessProSessionProvider>
  );
}
