import { HorsePhoto } from "@/components/HorsePhoto";
import { createPublicSupabaseClient } from "@/lib/supabase-public";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

type KeyViewHorse = {
  id: string;
  name: string;
  barn_name: string | null;
  primary_name_pref: "papered" | "barn" | null;
  breed: string | null;
  photo_url: string | null;
  barn_id: string;
  feed_regimen: string | null;
  supplements: string | null;
  special_care_notes: string | null;
  turnout_schedule: string | null;
};

type KeyViewBarn = {
  id: string;
  name: string;
  about: string | null;
  banner_url: string | null;
  logo_url: string | null;
  city: string | null;
  state: string | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  public_email: string | null;
  public_phone: string | null;
  barn_type: string;
};

type KeyViewHealthRecord = {
  id: string;
  record_type: string;
  provider_name: string | null;
  title: string | null;
  notes: string | null;
  description: string | null;
  details: string | null;
  record_date: string;
  next_due_date: string | null;
  document_url: string | null;
  performed_by_name: string | null;
  performed_at: string | null;
};

type KeyViewActivity = {
  id: string;
  activity_type: string | null;
  title: string | null;
  notes: string | null;
  description: string | null;
  activity_date: string;
  location: string | null;
  weather: string | null;
  mood: string | null;
  exercise_type: string | null;
  performed_by_name: string | null;
};

type KeyViewData = {
  ok: boolean;
  error?: "invalid_key" | "inactive";
  key_type?: "barn" | "stall";
  visibility_level?: "limited" | "full";
  label?: string | null;
  barn?: KeyViewBarn | null;
  horse?: KeyViewHorse | null;
  horses?: Pick<KeyViewHorse, "id" | "name" | "breed" | "photo_url">[] | null;
  last_shoeing?: KeyViewHealthRecord | null;
  last_worming?: KeyViewHealthRecord | null;
  activity_log?: KeyViewActivity[] | null;
  health_records?: KeyViewHealthRecord[] | null;
};

async function fetchKeyView(keyCode: string): Promise<KeyViewData | null> {
  const supabase = createPublicSupabaseClient();
  const { data, error } = await supabase.rpc("get_key_view_data", {
    p_key_code: keyCode,
  });
  if (error) return null;
  return data as unknown as KeyViewData;
}

function displayName(h: Pick<KeyViewHorse, "name" | "barn_name" | "primary_name_pref">): string {
  if (h.primary_name_pref === "barn" && h.barn_name) return h.barn_name;
  return h.name;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ key_code: string }>;
}): Promise<Metadata> {
  const { key_code } = await params;
  const data = await fetchKeyView(key_code);
  if (!data?.ok) return { title: "Invite link — BarnBook" };
  const title = data.horse ? displayName(data.horse) : data.barn?.name ?? "BarnBook";
  return {
    title: `${title} | BarnBook`,
    description: "View care details on BarnBook — no account needed.",
  };
}

function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5 py-2">
      <dt className="text-xs font-semibold uppercase tracking-wide text-barn-dark/45">{label}</dt>
      <dd className="whitespace-pre-line text-sm text-barn-dark/85">{value}</dd>
    </div>
  );
}

function HeaderBar() {
  return (
    <header className="border-b border-barn-dark/10 bg-white/80 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-lg items-center justify-between">
        <span className="font-serif text-lg font-semibold text-barn-dark">BarnBook</span>
        <Link href="/auth/signin" className="text-xs font-medium text-brass-gold hover:underline">
          Sign in
        </Link>
      </div>
    </header>
  );
}

function InactiveKeyPage() {
  return (
    <div className="min-h-screen bg-parchment">
      <HeaderBar />
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="font-serif text-2xl font-semibold text-barn-dark">
          This link is no longer active
        </h1>
        <p className="mt-3 text-sm text-barn-dark/60">
          The barn owner has revoked this invite. Ask them for a new one.
        </p>
        <Link href="/" className="mt-8 inline-block text-sm font-medium text-brass-gold hover:underline">
          Back to BarnBook
        </Link>
      </main>
    </div>
  );
}

function JoinCta({ href, primary, children }: { href: string; primary?: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={
        primary
          ? "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-brass-gold px-6 py-3 font-medium text-barn-dark shadow hover:brightness-110 transition"
          : "inline-flex min-h-[44px] items-center justify-center text-sm font-medium text-brass-gold hover:underline"
      }
    >
      {children}
    </Link>
  );
}

export default async function KeyViewPage({
  params,
}: {
  params: Promise<{ key_code: string }>;
}) {
  const { key_code } = await params;
  const data = await fetchKeyView(key_code);

  if (!data) notFound();
  if (data.error === "invalid_key") notFound();
  if (data.error === "inactive" || !data.ok) return <InactiveKeyPage />;

  const isFull = data.visibility_level === "full";
  const joinHref = `/join?key=${encodeURIComponent(key_code)}`;

  // ── Stall Key: single-horse view ──────────────────────────────────────
  if (data.key_type === "stall" && data.horse) {
    const horse = data.horse;
    const hasCare =
      horse.feed_regimen || horse.supplements || horse.special_care_notes || horse.turnout_schedule;
    const logHref = `/join?key=${encodeURIComponent(key_code)}&intent=log&horse=${horse.id}`;

    return (
      <div className="min-h-screen bg-parchment">
        <HeaderBar />
        <main className="mx-auto max-w-lg px-4 py-6">
          <div className="mb-5 flex items-center gap-4">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl">
              <HorsePhoto
                name={displayName(horse)}
                photoUrl={horse.photo_url}
                aspectClassName="aspect-square w-full"
                className="rounded-2xl"
              />
            </div>
            <div>
              <h1 className="font-serif text-2xl font-semibold text-barn-dark">
                {displayName(horse)}
              </h1>
              {horse.breed ? <p className="text-sm text-barn-dark/55">{horse.breed}</p> : null}
            </div>
          </div>

          <div className="rounded-2xl border border-barn-dark/10 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="font-serif text-lg text-barn-dark">Care Summary</h2>
            {!hasCare && !data.last_shoeing && !data.last_worming ? (
              <p className="mt-2 text-sm text-barn-dark/50">No care info yet.</p>
            ) : (
              <dl className="mt-1 divide-y divide-barn-dark/8">
                <Row label="Feed regimen" value={horse.feed_regimen} />
                <Row label="Supplements" value={horse.supplements} />
                <Row label="Special care notes" value={horse.special_care_notes} />
                <Row label="Turnout schedule" value={horse.turnout_schedule} />
                <Row
                  label="Last shoeing"
                  value={
                    data.last_shoeing
                      ? [formatDate(data.last_shoeing.record_date), data.last_shoeing.description]
                          .filter(Boolean)
                          .join(" — ")
                      : null
                  }
                />
                <Row
                  label="Last worming"
                  value={
                    data.last_worming
                      ? [formatDate(data.last_worming.record_date), data.last_worming.description]
                          .filter(Boolean)
                          .join(" — ")
                      : null
                  }
                />
              </dl>
            )}
          </div>

          {(data.activity_log?.length ?? 0) > 0 ? (
            <div className="mt-5 rounded-2xl border border-barn-dark/10 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="font-serif text-lg text-barn-dark">
                {isFull ? "Activity Log" : "Recent Activity"}
              </h2>
              <ul className="mt-3 space-y-3">
                {data.activity_log!.map((a) => (
                  <li key={a.id} className="border-b border-barn-dark/8 pb-3 last:border-0 last:pb-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-barn-dark/45">
                      {formatDate(a.activity_date)} · {a.activity_type ?? a.exercise_type ?? "Activity"}
                    </p>
                    <p className="mt-1 text-sm text-barn-dark/85">
                      {a.title || a.notes || a.description || "—"}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {isFull && (data.health_records?.length ?? 0) > 0 ? (
            <div className="mt-5 rounded-2xl border border-barn-dark/10 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="font-serif text-lg text-barn-dark">Health Records</h2>
              <ul className="mt-3 space-y-3">
                {data.health_records!.map((r) => (
                  <li key={r.id} className="border-b border-barn-dark/8 pb-3 last:border-0 last:pb-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-barn-dark/45">
                      {formatDate(r.record_date)} · {r.record_type}
                    </p>
                    <p className="mt-1 text-sm text-barn-dark/85">
                      {r.title || r.description || r.notes || "—"}
                    </p>
                    {r.provider_name ? (
                      <p className="mt-0.5 text-xs text-barn-dark/50">{r.provider_name}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-5 space-y-3 rounded-2xl border border-barn-dark/10 bg-white p-5 shadow-sm text-center">
            <p className="text-sm text-barn-dark/60">
              Want to add a log or take over care?
            </p>
            <JoinCta href={logHref} primary>
              Create an account
            </JoinCta>
            <div>
              <JoinCta href={joinHref}>Already have a key code? Enter it manually</JoinCta>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-barn-dark/40">
            Powered by <Link href="/" className="text-brass-gold hover:underline">BarnBook</Link> —
            Every horse. Every detail. One book.
          </p>
        </main>
      </div>
    );
  }

  // ── Barn Key: barn-wide view ──────────────────────────────────────────
  if (data.key_type === "barn" && data.barn) {
    const barn = data.barn;
    return (
      <div className="min-h-screen bg-parchment">
        <HeaderBar />
        <main className="mx-auto max-w-lg px-4 py-6">
          <div className="mb-5 flex items-center gap-4">
            {barn.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={barn.logo_url}
                alt={barn.name}
                className="h-20 w-20 shrink-0 rounded-2xl object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-barn-dark">
                <span className="font-serif text-2xl font-semibold text-brass-gold">
                  {barn.name.charAt(0)}
                </span>
              </div>
            )}
            <div>
              <h1 className="font-serif text-2xl font-semibold text-barn-dark">{barn.name}</h1>
              {[barn.city, barn.state].filter(Boolean).join(", ") ? (
                <p className="text-sm text-barn-dark/55">
                  {[barn.city, barn.state].filter(Boolean).join(", ")}
                </p>
              ) : null}
            </div>
          </div>

          {barn.about ? (
            <div className="rounded-2xl border border-barn-dark/10 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="font-serif text-lg text-barn-dark">About</h2>
              <p className="mt-2 whitespace-pre-line text-sm text-barn-dark/75">{barn.about}</p>
            </div>
          ) : null}

          {(data.horses?.length ?? 0) > 0 ? (
            <div className="mt-5">
              <h2 className="font-serif text-lg text-barn-dark">Horses</h2>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {data.horses!.map((h) => (
                  <Link
                    key={h.id}
                    href={`/care/${h.id}`}
                    className="overflow-hidden rounded-2xl border border-barn-dark/10 bg-white shadow-sm transition hover:border-brass-gold/40"
                  >
                    <div className="aspect-[4/3] overflow-hidden">
                      <HorsePhoto
                        name={h.name}
                        photoUrl={h.photo_url}
                        aspectClassName="aspect-[4/3] w-full"
                      />
                    </div>
                    <div className="p-2.5">
                      <p className="text-sm font-medium text-barn-dark">{h.name}</p>
                      {h.breed ? <p className="text-xs text-barn-dark/50">{h.breed}</p> : null}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-5 space-y-3 rounded-2xl border border-barn-dark/10 bg-white p-5 shadow-sm text-center">
            <p className="text-sm text-barn-dark/60">
              Want to add a log or take over care?
            </p>
            <JoinCta href={joinHref} primary>
              Create an account
            </JoinCta>
          </div>

          <p className="mt-6 text-center text-xs text-barn-dark/40">
            Powered by <Link href="/" className="text-brass-gold hover:underline">BarnBook</Link> —
            Every horse. Every detail. One book.
          </p>
        </main>
      </div>
    );
  }

  notFound();
}
