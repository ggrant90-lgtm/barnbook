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

  // Business Pro + receipt scan context. Only load these when an
  // active barn exists — the receipt scanner is always barn-scoped.
  let hasBusinessPro = false;
  let barnClients: Array<{
    id: string;
    display_name: string;
    user_id: string | null;
    name_key: string;
  }> = [];
  let barnMembers: Array<{ id: string; name: string; role: string }> = [];
  let customCategories: string[] = [];

  if (activeBarnId) {
    const [profileRes, clientsRes, membersRes, catsRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("has_business_pro")
        .eq("id", user.id)
        .maybeSingle(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from("barn_clients")
        .select("id, display_name, user_id, name_key")
        .eq("barn_id", activeBarnId)
        .eq("archived", false)
        .order("display_name", { ascending: true }),
      supabase
        .from("barn_members")
        .select("user_id, role")
        .eq("barn_id", activeBarnId)
        .or("status.eq.active,status.is.null"),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from("barn_expenses")
        .select("category")
        .eq("barn_id", activeBarnId)
        .limit(500),
    ]);

    hasBusinessPro = profileRes.data?.has_business_pro === true;
    barnClients = (clientsRes.data ?? []) as typeof barnClients;

    const memberRows = (membersRes.data ?? []) as Array<{
      user_id: string;
      role: string | null;
    }>;
    const memberIds = [...new Set(memberRows.map((m) => m.user_id))];
    let profiles: Array<{ id: string; full_name: string | null }> = [];
    if (memberIds.length > 0) {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", memberIds);
      profiles = (data ?? []) as typeof profiles;
    }
    const roleById = new Map(memberRows.map((m) => [m.user_id, m.role ?? "member"]));
    barnMembers = memberIds.map((id) => ({
      id,
      name: profiles.find((p) => p.id === id)?.full_name?.trim() || "Member",
      role: roleById.get(id) ?? "member",
    }));

    const catRows = (catsRes.data ?? []) as Array<{ category: string }>;
    customCategories = [...new Set(catRows.map((r) => r.category).filter(Boolean))];
  }

  return (
    <IdentifyLanding
      hasDocumentScanner={hasDocumentScanner}
      activeBarnId={activeBarnId}
      activeBarnName={activeBarnName}
      hasBusinessPro={hasBusinessPro}
      barnClients={barnClients}
      barnMembers={barnMembers}
      customCategories={customCategories}
    />
  );
}
