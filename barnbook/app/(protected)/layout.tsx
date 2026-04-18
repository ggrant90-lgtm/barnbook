import { InstallPrompt } from "@/components/InstallPrompt";
import { ProtectedChrome } from "@/components/protected/ProtectedChrome";
import { getActiveBarnContext } from "@/lib/barn-session";
import { createServerComponentClient } from "@/lib/supabase-server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Barn } from "@/lib/types";

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

  // Fetch ALL barns the user has access to (owned + member)
  const { data: ownedBarns } = await supabase
    .from("barns")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true });

  const { data: memberships } = await supabase
    .from("barn_members")
    .select("barn_id")
    .eq("user_id", user.id)
    .or("status.eq.active,status.is.null");

  const memberBarnIds = (memberships ?? [])
    .map((m) => m.barn_id)
    .filter((id) => !(ownedBarns ?? []).some((b) => b.id === id));

  let memberBarns: Barn[] = [];
  if (memberBarnIds.length > 0) {
    const { data: mBarns } = await supabase
      .from("barns")
      .select("*")
      .in("id", memberBarnIds);
    memberBarns = (mBarns ?? []) as Barn[];
  }

  const allBarns = [...((ownedBarns ?? []) as Barn[]), ...memberBarns];

  // Determine active barn from cookie or default to primary
  const cookieStore = await cookies();
  const activeBarnId = cookieStore.get("active_barn_id")?.value;
  const ctx = await getActiveBarnContext(supabase, user.id);

  const activeBarn = activeBarnId
    ? allBarns.find((b) => b.id === activeBarnId) ?? ctx?.barn ?? null
    : ctx?.barn ?? null;

  const hasBarn = allBarns.length > 0;
  const barnName = activeBarn?.name ?? null;
  // Only users who own at least one barn can generate/manage keys — the
  // nav item gets hidden from barn-key and stall-key holders.
  const isBarnOwner = (ownedBarns ?? []).length > 0;

  return (
    <ProtectedChrome
      displayName={displayName}
      email={user.email ?? ""}
      avatarUrl={profile?.avatar_url ?? null}
      barnName={barnName}
      hasBarn={hasBarn}
      isBarnOwner={isBarnOwner}
      allBarns={allBarns.map((b) => ({ id: b.id, name: b.name, barn_type: b.barn_type }))}
      activeBarnId={activeBarn?.id ?? null}
    >
      <InstallPrompt />
      {children}
    </ProtectedChrome>
  );
}
