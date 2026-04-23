import { redirect } from "next/navigation";
import { createServerComponentClient } from "@/lib/supabase-server";
import { getActiveBarnId } from "@/lib/barn-session";
import type { Barn } from "@/lib/types";
import { BarnLogsClient } from "./BarnLogsClient";

/**
 * Barn Logs — general-purpose barn-level activity + expense log.
 *
 * Not BP-gated: any barn owner or editor member can record logs,
 * whether or not they have Business Pro. BP users get the full
 * FinancialsSection inside the form; non-BP users get a lean
 * date/category/description/cost row.
 *
 * Scoping:
 *   - Active barn = specific barn → list is scoped to that barn.
 *   - Active barn = "__all__" → renders a barn-picker strip, then
 *     scopes to the first owned barn (if any) by default. User can
 *     switch via the picker without changing their active barn
 *     context globally.
 */
export default async function BarnLogsPage() {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  // Barns the user can write logs on: owned OR editor-role member.
  // View-only members and stall-key holders aren't surfaced here.
  const [ownedRes, memberRes] = await Promise.all([
    supabase
      .from("barns")
      .select("*")
      .eq("owner_id", user.id)
      .order("name", { ascending: true }),
    supabase
      .from("barn_members")
      .select("barn_id, role")
      .eq("user_id", user.id)
      .or("status.eq.active,status.is.null"),
  ]);

  const ownedBarns = (ownedRes.data ?? []) as Barn[];
  const editorMemberships = ((memberRes.data ?? []) as Array<{
    barn_id: string;
    role: string | null;
  }>).filter(
    (m) =>
      m.role === "owner" || m.role === "admin" || m.role === "editor",
  );
  const memberBarnIds = editorMemberships
    .map((m) => m.barn_id)
    .filter((id) => !ownedBarns.some((b) => b.id === id));

  let memberBarns: Barn[] = [];
  if (memberBarnIds.length > 0) {
    const { data } = await supabase
      .from("barns")
      .select("*")
      .in("id", memberBarnIds)
      .order("name", { ascending: true });
    memberBarns = (data ?? []) as Barn[];
  }

  const writableBarns = [...ownedBarns, ...memberBarns];

  if (writableBarns.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="font-serif text-2xl font-semibold text-barn-dark">
          Barn Logs
        </h1>
        <p className="mt-3 text-sm text-barn-dark/60">
          Barn logs are available once you own or help run a barn. Create
          a barn to get started.
        </p>
      </div>
    );
  }

  // Pick the scoped barn: honor the active_barn_id cookie when it
  // points at a writable barn, otherwise fall back to the first owned.
  const activeBarnId = await getActiveBarnId();
  const scopedBarn =
    (activeBarnId && activeBarnId !== "__all__"
      ? writableBarns.find((b) => b.id === activeBarnId)
      : null) ?? writableBarns[0];

  // Fetch this barn's logs + BP context in parallel.
  const [logsRes, profileRes, clientsRes, membersRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("barn_expenses")
      .select("*")
      .eq("barn_id", scopedBarn.id)
      .order("performed_at", { ascending: false })
      .limit(500),
    supabase
      .from("profiles")
      .select("has_business_pro")
      .eq("id", user.id)
      .maybeSingle(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("barn_clients")
      .select("id, display_name, user_id, name_key")
      .eq("barn_id", scopedBarn.id)
      .eq("archived", false)
      .order("display_name", { ascending: true }),
    supabase
      .from("barn_members")
      .select("user_id, role")
      .eq("barn_id", scopedBarn.id)
      .or("status.eq.active,status.is.null"),
  ]);

  const hasBusinessPro = profileRes.data?.has_business_pro === true;
  const logs = (logsRes.data ?? []) as Array<{
    id: string;
    barn_id: string;
    performed_at: string;
    category: string;
    total_cost: number;
    vendor_name: string | null;
    description: string | null;
    notes: string | null;
    cost_type: "expense" | "revenue" | "pass_through" | null;
    billable_to_user_id: string | null;
    billable_to_name: string | null;
    payment_status: "unpaid" | "paid" | "partial" | "waived" | null;
    paid_amount: number | null;
    paid_at: string | null;
  }>;

  const barnClients = (clientsRes.data ?? []) as Array<{
    id: string;
    display_name: string;
    user_id: string | null;
    name_key: string;
  }>;

  // Resolve member profiles for the "Billable to member" picker.
  const memberIds = [
    ...new Set(((membersRes.data ?? []) as Array<{ user_id: string }>).map(
      (m) => m.user_id,
    )),
  ];
  let memberProfiles: Array<{ id: string; full_name: string | null }> = [];
  if (memberIds.length > 0) {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", memberIds);
    memberProfiles = (data ?? []) as typeof memberProfiles;
  }
  const roleByUser = new Map(
    ((membersRes.data ?? []) as Array<{ user_id: string; role: string | null }>).map(
      (m) => [m.user_id, m.role ?? "member"],
    ),
  );
  const barnMembers = memberIds.map((id) => ({
    id,
    name:
      memberProfiles.find((p) => p.id === id)?.full_name?.trim() || "Member",
    role: roleByUser.get(id) ?? "member",
  }));

  // Distinct custom categories from existing rows — appended to the
  // preset list so once a user coins one, it's a preset going forward.
  const customCategories = [
    ...new Set(
      logs
        .map((l) => l.category)
        .filter((c): c is string => !!c && c.trim().length > 0),
    ),
  ];

  return (
    <BarnLogsClient
      scopedBarn={{
        id: scopedBarn.id,
        name: scopedBarn.name,
      }}
      writableBarns={writableBarns.map((b) => ({ id: b.id, name: b.name }))}
      logs={logs}
      hasBusinessPro={hasBusinessPro}
      barnMembers={barnMembers}
      barnClients={barnClients}
      customCategories={customCategories}
    />
  );
}
