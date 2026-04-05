import { getActiveBarnContext } from "@/lib/barn-session";
import { canManageBarnKeys } from "@/lib/key-access";
import { createServerComponentClient } from "@/lib/supabase-server";
import type { KeyRequest } from "@/lib/types";
import { redirect } from "next/navigation";
import { KeysRequestsClient } from "./KeysRequestsClient";

export default async function KeysRequestsPage() {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const ctx = await getActiveBarnContext(supabase, user.id);
  if (!ctx) redirect("/dashboard");

  const barnId = ctx.barn.id;
  const canManage = await canManageBarnKeys(supabase, user.id, barnId);
  if (!canManage) redirect("/dashboard");

  const { data: rows } = await supabase
    .from("key_requests")
    .select("*")
    .eq("barn_id", barnId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  const requests = (rows ?? []) as KeyRequest[];
  const reqIds = [...new Set(requests.map((r) => r.requester_id))];
  let requesterNames: Record<string, string> = {};
  if (reqIds.length > 0) {
    const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", reqIds);
    requesterNames = Object.fromEntries(
      (profs ?? []).map((p) => [p.id, p.full_name?.trim() || "Member"]),
    );
  }

  return (
    <KeysRequestsClient
      barnName={ctx.barn.name}
      requests={requests}
      requesterNames={requesterNames}
    />
  );
}
