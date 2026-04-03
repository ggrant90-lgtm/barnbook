import { HorseCard } from "@/components/HorseCard";
import { getPrimaryBarnContext } from "@/lib/barn-session";
import { createServerComponentClient } from "@/lib/supabase-server";
import type { ActivityLog, Horse } from "@/lib/types";
import Link from "next/link";

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

  const ctx = await getPrimaryBarnContext(supabase, user.id);

  if (!ctx) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 sm:px-6">
        <h1 className="font-serif text-3xl font-semibold text-barn-dark">Welcome to BarnBook</h1>
        <p className="mt-3 text-barn-dark/80">
          You’re not linked to a barn yet. Create one, redeem a key, or request access from a barn
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

  const { barn } = ctx;
  const barnId = barn.id;

  const [
    horsesRes,
    keysRes,
    pendingRes,
    horseIdsForActivity,
  ] = await Promise.all([
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

  const horses = (horsesRes.data ?? []) as Pick<
    Horse,
    "id" | "name" | "photo_url" | "breed" | "sex" | "color" | "updated_at"
  >[];
  const horseCount = horses.length;
  const activeKeys = keysRes.count ?? 0;
  const pendingRequests = pendingRes.count ?? 0;

  const ids = (horseIdsForActivity.data ?? []).map((r) => r.id);
  let recentActivity: { log: ActivityLog; horseName: string }[] = [];

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

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-barn-dark">{barn.name}</h1>
          <p className="text-sm text-barn-dark/65">Barn dashboard</p>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-barn-dark/10 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-barn-dark/50">Horses</p>
          <p className="mt-1 font-serif text-3xl text-barn-dark">{horseCount}</p>
        </div>
        <div className="rounded-2xl border border-barn-dark/10 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-barn-dark/50">Active keys</p>
          <p className="mt-1 font-serif text-3xl text-barn-dark">{activeKeys}</p>
        </div>
        <div className="rounded-2xl border border-barn-dark/10 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-barn-dark/50">
            Pending requests
          </p>
          <p className="mt-1 font-serif text-3xl text-barn-dark">{pendingRequests}</p>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/horses/new"
          className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-brass-gold px-5 py-2.5 text-sm font-medium text-barn-dark shadow hover:brightness-110"
        >
          Add Horse
        </Link>
        <Link
          href="/keys"
          className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-barn-dark/20 bg-white px-5 py-2.5 text-sm font-medium text-barn-dark hover:border-brass-gold"
        >
          Generate Key
        </Link>
        <Link
          href="/keys/requests"
          className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-barn-dark/20 bg-white px-5 py-2.5 text-sm font-medium text-barn-dark hover:border-brass-gold"
        >
          View Requests
        </Link>
      </div>

      <section className="mt-12">
        <h2 className="font-serif text-xl text-barn-dark">Horses</h2>
        {horsesRes.error ? (
          <p className="mt-2 text-sm text-barn-red">Could not load horses. Check database setup.</p>
        ) : horses.length === 0 ? (
          <p className="mt-3 text-barn-dark/70">No horses yet. Add your first horse to get started.</p>
        ) : (
          <ul className="mt-4 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {horses.map((h) => (
              <li key={h.id}>
                <HorseCard horse={h} href={`/horses/${h.id}`} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12">
        <h2 className="font-serif text-xl text-barn-dark">Recent activity</h2>
        {recentActivity.length === 0 ? (
          <p className="mt-3 text-barn-dark/70">No activity log entries yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-barn-dark/10 rounded-2xl border border-barn-dark/10 bg-white">
            {recentActivity.map(({ log, horseName }) => (
              <li key={log.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-barn-dark">{log.activity_type}</p>
                  <p className="text-sm text-barn-dark/65">{horseName}</p>
                </div>
                <time className="text-xs text-barn-dark/50" dateTime={log.created_at}>
                  {formatWhen(log.created_at)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
