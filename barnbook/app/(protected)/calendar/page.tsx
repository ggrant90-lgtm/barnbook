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
  const isServiceBarn = ctx.barn.barn_type === "service";

  // Horses for the filter dropdown. On a Service Barn this includes
  // both quick records (in this barn) and linked horses (at other
  // barns). On a standard barn it's just the barn's horses.
  let horses: { id: string; name: string }[] = [];
  if (isServiceBarn) {
    const [quickRes, linksRes] = await Promise.all([
      supabase
        .from("horses")
        .select("id, name")
        .eq("barn_id", barnId)
        .eq("is_quick_record", true)
        .eq("archived", false)
        .order("name", { ascending: true }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from("service_barn_links")
        .select("horse_id")
        .eq("service_barn_id", barnId),
    ]);
    const quicks = (quickRes.data ?? []) as { id: string; name: string }[];
    const linkIds = ((linksRes.data ?? []) as Array<{ horse_id: string }>).map(
      (l) => l.horse_id,
    );
    let linked: { id: string; name: string }[] = [];
    if (linkIds.length > 0) {
      const { data } = await supabase
        .from("horses")
        .select("id, name")
        .in("id", linkIds)
        .eq("archived", false);
      linked = (data ?? []) as { id: string; name: string }[];
    }
    horses = [...quicks, ...linked].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
  } else {
    const { data: horsesRaw } = await supabase
      .from("horses")
      .select("id, name")
      .eq("barn_id", barnId)
      .eq("archived", false)
      .order("name", { ascending: true });
    horses = (horsesRaw ?? []) as { id: string; name: string }[];
  }

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
    serviceBarnMode: isServiceBarn,
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
        serviceBarnMode={isServiceBarn}
      />
    </div>
  );
}
