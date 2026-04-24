import { redirect } from "next/navigation";
import { createServerComponentClient } from "@/lib/supabase-server";
import { getActiveBarnContext } from "@/lib/barn-session";
import {
  canUserUseDocumentScanner,
  userHasAnyScannerAccess,
} from "@/lib/document-scanner/access";
import { IdentifyLanding } from "./IdentifyLanding";

export default async function IdentifyPage() {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const ctx = await getActiveBarnContext(supabase, user.id);
  const activeBarnId = ctx?.barn.id ?? null;
  const activeBarnName = ctx?.barn.name ?? null;

  const hasDocumentScanner = activeBarnId
    ? await canUserUseDocumentScanner(supabase, user.id, activeBarnId)
    : await userHasAnyScannerAccess(supabase, user.id);

  // Every barn the user can write receipts to (owner or editor
  // member). The receipt review step uses this to let multi-barn
  // users switch which barn the log posts to.
  const [ownedRes, memberRes] = await Promise.all([
    supabase
      .from("barns")
      .select("id, name")
      .eq("owner_id", user.id)
      .order("name", { ascending: true }),
    supabase
      .from("barn_members")
      .select("barn_id, role")
      .eq("user_id", user.id)
      .or("status.eq.active,status.is.null"),
  ]);

  const ownedBarns = (ownedRes.data ?? []) as Array<{ id: string; name: string }>;
  const editorMemberBarnIds = ((memberRes.data ?? []) as Array<{
    barn_id: string;
    role: string | null;
  }>)
    .filter((m) => m.role === "owner" || m.role === "admin" || m.role === "editor")
    .map((m) => m.barn_id)
    .filter((id) => !ownedBarns.some((b) => b.id === id));

  let memberBarns: Array<{ id: string; name: string }> = [];
  if (editorMemberBarnIds.length > 0) {
    const { data } = await supabase
      .from("barns")
      .select("id, name")
      .in("id", editorMemberBarnIds)
      .order("name", { ascending: true });
    memberBarns = (data ?? []) as typeof memberBarns;
  }
  const writableBarns = [...ownedBarns, ...memberBarns];

  return (
    <IdentifyLanding
      hasDocumentScanner={hasDocumentScanner}
      activeBarnId={activeBarnId}
      activeBarnName={activeBarnName}
      writableBarns={writableBarns}
    />
  );
}
