import { getActiveBarnContext } from "@/lib/barn-session";
import { createServerComponentClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { getCalendarEvents } from "@/app/(protected)/actions/calendar";
import { CalendarClient } from "@/components/calendar/CalendarClient";

export default async function CalendarPage() {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const ctx = await getActiveBarnContext(supabase, user.id);
  if (!ctx) redirect("/dashboard");

  const barnId = ctx.barn.id;

  // Fetch horses in this barn
  const { data: horsesRaw } = await supabase
    .from("horses")
    .select("id, name")
    .eq("barn_id", barnId)
    .eq("archived", false)
    .order("name", { ascending: true });

  const horses = (horsesRaw ?? []) as { id: string; name: string }[];

  // Fetch barn members for performer filter + quick-add
  const { data: barnMembers } = await supabase
    .from("barn_members")
    .select("user_id, role")
    .eq("barn_id", barnId)
    .or("status.eq.active,status.is.null");

  const memberIds = [...new Set((barnMembers ?? []).map((m) => m.user_id))];
  let memberProfiles: { id: string; full_name: string | null }[] = [];
  if (memberIds.length > 0) {
    const { data: mp } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", memberIds);
    memberProfiles = mp ?? [];
  }

  const nameByUser = new Map(
    memberProfiles.map((p) => [p.id, p.full_name?.trim() || "Member"]),
  );
  const roleByUser = new Map(
    (barnMembers ?? []).map((m) => [m.user_id, m.role]),
  );

  const barnMembersList = memberIds.map((id) => ({
    id,
    name: nameByUser.get(id) ?? "Member",
    role: roleByUser.get(id) ?? "member",
  }));

  // Fetch initial events — current month padded
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  monthStart.setDate(monthStart.getDate() - 7); // pad a week before
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  monthEnd.setDate(monthEnd.getDate() + 14); // pad two weeks after

  const { events: initialEvents } = await getCalendarEvents({
    barnId,
    start: monthStart.toISOString(),
    end: monthEnd.toISOString(),
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <h1 className="font-serif text-2xl font-semibold text-barn-dark mb-4">
        Calendar
      </h1>

      <CalendarClient
        barnId={barnId}
        initialEvents={initialEvents}
        horses={horses}
        barnMembers={barnMembersList}
        currentUserId={user.id}
      />
    </div>
  );
}
