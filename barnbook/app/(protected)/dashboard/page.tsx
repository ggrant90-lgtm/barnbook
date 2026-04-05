import { HorseCard } from "@/components/HorseCard";
import { HorsePhoto } from "@/components/HorsePhoto";
import { getActiveBarnId } from "@/lib/barn-session";
import { createServerComponentClient } from "@/lib/supabase-server";
import type { ActivityLog, Barn, Horse } from "@/lib/types";
import Link from "next/link";
import { DashboardTabs } from "./DashboardTabs";

function formatWhen(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString();
}

export default async function DashboardPage() {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // ── My Barns: barns the user owns ──
  const { data: ownedBarns } = await supabase
    .from("barns")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true });

  // ── Barn Access: barns where user is a member but NOT owner ──
  const { data: memberships } = await supabase
    .from("barn_members")
    .select("barn_id, role, status")
    .eq("user_id", user.id)
    .or("status.eq.active,status.is.null");

  const ownedIds = new Set((ownedBarns ?? []).map((b) => b.id));
  const accessMemberships = (memberships ?? []).filter(
    (m) => !ownedIds.has(m.barn_id),
  );

  // Fetch barn details for access barns
  const accessBarnIds = accessMemberships.map((m) => m.barn_id);
  let accessBarns: (Barn & { userRole: string })[] = [];
  if (accessBarnIds.length > 0) {
    const { data: barnsData } = await supabase
      .from("barns")
      .select("*")
      .in("id", accessBarnIds);

    const roleMap = new Map(accessMemberships.map((m) => [m.barn_id, m.role]));
    accessBarns = ((barnsData ?? []) as Barn[]).map((b) => ({
      ...b,
      userRole: roleMap.get(b.id) ?? "member",
    }));
  }

  // Check if user has no barns at all
  const hasNoBarns = (ownedBarns ?? []).length === 0 && accessBarns.length === 0;

  if (hasNoBarns) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 sm:px-6">
        <h1 className="font-serif text-3xl font-semibold text-barn-dark">Welcome to BarnBook</h1>
        <p className="mt-3 text-barn-dark/80">
          You&apos;re not linked to a barn yet. Create one, redeem a key, or request access from a barn
          you work with.
        </p>

        <div className="mt-10 flex flex-col gap-4">
          <Link
            href="/barn/new"
            className="flex min-h-[52px] items-center justify-center rounded-xl bg-brass-gold px-6 py-3 text-center font-medium text-barn-dark shadow-md transition hover:brightness-110"
          >
            Create Your Barn
          </Link>
          <Link
            href="/join"
            className="flex min-h-[52px] items-center justify-center rounded-xl border-2 border-barn-dark/20 bg-white px-6 py-3 text-center font-medium text-barn-dark transition hover:border-brass-gold hover:bg-parchment"
          >
            I Have a Key
          </Link>
        </div>

        <section className="mt-12 rounded-2xl border border-barn-dark/10 bg-white p-6 shadow-sm">
          <h2 className="font-serif text-lg text-barn-dark">Request access</h2>
          <p className="mt-2 text-sm leading-relaxed text-barn-dark/75">
            If your trainer or barn manager invited you by email, ask them for a Barn Key or Stall Key.
            You can redeem keys on the next screen. For access without a key, contact your barn owner —
            they can send an invite or approve your request when that flow is enabled.
          </p>
        </section>
      </div>
    );
  }

  // ── Determine which barn to show (active barn from cookie, or first owned) ──
  const activeBarnId = await getActiveBarnId();
  const allUserBarns = [...(ownedBarns ?? []) as Barn[], ...accessBarns];
  const primaryBarn = activeBarnId
    ? allUserBarns.find((b) => b.id === activeBarnId) ?? (ownedBarns ?? [])[0] ?? null
    : (ownedBarns ?? [])[0] ?? null;
  let horses: Pick<Horse, "id" | "name" | "photo_url" | "breed" | "sex" | "color" | "updated_at">[] = [];
  let horseCount = 0;
  let activeKeys = 0;
  let pendingRequests = 0;
  let recentActivity: { log: ActivityLog; horseName: string }[] = [];

  if (primaryBarn) {
    const barnId = primaryBarn.id;
    const [horsesRes, keysRes, pendingRes, horseIdsForActivity] = await Promise.all([
      supabase
        .from("horses")
        .select("id, name, photo_url, breed, sex, color, updated_at")
        .eq("barn_id", barnId)
        .order("name", { ascending: true })
        .limit(24),
      supabase
        .from("access_keys")
        .select("id", { count: "exact", head: true })
        .eq("barn_id", barnId)
        .eq("is_active", true),
      supabase
        .from("key_requests")
        .select("id", { count: "exact", head: true })
        .eq("barn_id", barnId)
        .eq("status", "pending"),
      supabase.from("horses").select("id").eq("barn_id", barnId),
    ]);

    horses = (horsesRes.data ?? []) as typeof horses;
    horseCount = horses.length;
    activeKeys = keysRes.count ?? 0;
    pendingRequests = pendingRes.count ?? 0;

    const ids = (horseIdsForActivity.data ?? []).map((r) => r.id);
    if (ids.length > 0) {
      const { data: logs } = await supabase
        .from("activity_log")
        .select("*")
        .in("horse_id", ids)
        .order("created_at", { ascending: false })
        .limit(5);

      const nameByHorse = new Map(horses.map((h) => [h.id, h.name]));
      recentActivity = (logs ?? []).map((log) => ({
        log: log as ActivityLog,
        horseName: nameByHorse.get(log.horse_id) ?? "Horse",
      }));
    }
  }

  // Fetch horses for each access barn
  const accessBarnHorses: Record<string, Pick<Horse, "id" | "name" | "breed" | "photo_url">[]> = {};
  if (accessBarnIds.length > 0) {
    const { data: allAccessHorses } = await supabase
      .from("horses")
      .select("id, name, breed, photo_url, barn_id")
      .in("barn_id", accessBarnIds)
      .order("name", { ascending: true });

    for (const h of allAccessHorses ?? []) {
      const bid = (h as { barn_id: string }).barn_id;
      if (!accessBarnHorses[bid]) accessBarnHorses[bid] = [];
      accessBarnHorses[bid].push(h);
    }
  }

  return (
    <DashboardTabs
      ownedBarns={(ownedBarns ?? []) as Barn[]}
      accessBarns={accessBarns}
      accessBarnHorses={accessBarnHorses}
      primaryBarn={primaryBarn as Barn | null}
      horses={horses}
      horseCount={horseCount}
      activeKeys={activeKeys}
      pendingRequests={pendingRequests}
      recentActivity={recentActivity}
    />
  );
}
