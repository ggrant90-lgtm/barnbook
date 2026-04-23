import { createServerComponentClient } from "@/lib/supabase-server";
import type { Horse } from "@/lib/types";
import { ProfileForm } from "./ProfileForm";

export default async function ProfilePage() {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const meta = user.user_metadata as { full_name?: string } | undefined;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  const fullName =
    profile?.full_name?.trim() || meta?.full_name?.trim() || "";
  const phone = profile?.phone?.trim() || "";
  const avatarUrl = profile?.avatar_url?.trim() || "";

  const { data: membershipsRaw } = await supabase
    .from("barn_members")
    .select("*")
    .eq("user_id", user.id);

  const memberships = membershipsRaw ?? [];
  const barnIds = [...new Set(memberships.map((m) => m.barn_id))];
  let barnNameById = new Map<string, string>();

  if (barnIds.length > 0) {
    const { data: barnRows } = await supabase
      .from("barns")
      .select("id, name")
      .in("id", barnIds);
    barnNameById = new Map((barnRows ?? []).map((b) => [b.id, b.name]));
  }

  const { data: accessRows } = await supabase
    .from("user_horse_access")
    .select("horse_id")
    .eq("user_id", user.id);

  const horseIds = [...new Set((accessRows ?? []).map((a) => a.horse_id))];
  let stallHorses: Pick<Horse, "id" | "name" | "photo_url">[] = [];

  if (horseIds.length > 0) {
    const { data: horses } = await supabase
      .from("horses")
      .select("id, name, photo_url")
      .in("id", horseIds);
    stallHorses = (horses ?? []) as Pick<Horse, "id" | "name" | "photo_url">[];
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="font-serif text-3xl font-semibold text-barn-dark">Profile</h1>
      <p className="mt-1 text-barn-dark/65">Your account and barn access.</p>

      <section className="mt-10 rounded-2xl border border-barn-dark/10 bg-white p-6 shadow-sm">
        <h2 className="font-serif text-lg text-barn-dark">Your details</h2>
        <div className="mt-6">
          <ProfileForm
            email={user.email ?? ""}
            initialFullName={fullName}
            initialPhone={phone}
            initialAvatarUrl={avatarUrl}
          />
        </div>
      </section>

      <section className="mt-10 rounded-2xl border border-barn-dark/10 bg-white p-6 shadow-sm">
        <h2 className="font-serif text-lg text-barn-dark">Your barns</h2>
        {memberships.length === 0 ? (
          <p className="mt-3 text-sm text-barn-dark/70">You’re not a member of any barn yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-barn-dark/10">
            {memberships.map((m) => (
              <li key={m.id} className="flex items-center justify-between py-3">
                <span className="font-medium text-barn-dark">
                  {barnNameById.get(m.barn_id) ?? "Barn"}
                </span>
                <span className="rounded-full bg-barn-dark/5 px-2.5 py-0.5 text-xs capitalize text-barn-dark/80">
                  {m.role}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10 rounded-2xl border border-barn-dark/10 bg-white p-6 shadow-sm">
        <h2 className="font-serif text-lg text-barn-dark">Horses via Stall Keys</h2>
        <p className="mt-1 text-sm text-barn-dark/65">
          Individual horse access granted when you redeem a Stall Key.
        </p>
        {stallHorses.length === 0 ? (
          <p className="mt-3 text-sm text-barn-dark/70">No stall-key access yet.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {stallHorses.map((h) => (
              <li key={h.id} className="flex items-center gap-3 rounded-xl border border-barn-dark/10 p-3">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-barn-dark/5">
                  {h.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={h.photo_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center font-serif text-lg text-barn-dark/30">
                      {h.name.charAt(0)}
                    </div>
                  )}
                </div>
                <span className="font-medium text-barn-dark">{h.name}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
