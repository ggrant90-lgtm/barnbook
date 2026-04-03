import { ProtectedChrome } from "@/components/protected/ProtectedChrome";
import { getPrimaryBarnContext } from "@/lib/barn-session";
import { createServerComponentClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/signin");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  const meta = user.user_metadata as { full_name?: string } | undefined;
  const displayName =
    profile?.full_name?.trim() ||
    meta?.full_name?.trim() ||
    user.email?.split("@")[0] ||
    "Member";

  const ctx = await getPrimaryBarnContext(supabase, user.id);
  const hasBarn = ctx !== null;
  const barnName = ctx?.barn.name ?? null;

  return (
    <ProtectedChrome
      displayName={displayName}
      email={user.email ?? ""}
      avatarUrl={profile?.avatar_url ?? null}
      barnName={barnName}
      hasBarn={hasBarn}
    >
      {children}
    </ProtectedChrome>
  );
}
