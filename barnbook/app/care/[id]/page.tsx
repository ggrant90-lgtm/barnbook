import { CareCard } from "@/components/CareCard";
import { HorsePhoto } from "@/components/HorsePhoto";
import { createPublicSupabaseClient } from "@/lib/supabase-public";
import type { HealthRecord } from "@/lib/types";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

/** Only select publicly-safe columns — never expose owner data or internal IDs */
const PUBLIC_HORSE_FIELDS =
  "id, name, breed, photo_url, feed_regimen, supplements, special_care_notes, turnout_schedule" as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = createPublicSupabaseClient();
  const { data } = await supabase
    .from("horses")
    .select("name, breed")
    .eq("id", id)
    .single();

  if (!data) return { title: "Horse not found — BarnBook" };
  return {
    title: `${data.name} — Care Summary | BarnBook`,
    description: `Care summary for ${data.name}${data.breed ? ` (${data.breed})` : ""}. Feed, supplements, shoeing & worming info.`,
  };
}

export default async function PublicCareCardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createPublicSupabaseClient();

  const { data: horse, error } = await supabase
    .from("horses")
    .select(PUBLIC_HORSE_FIELDS)
    .eq("id", id)
    .single();

  if (error || !horse) notFound();

  // Pull latest shoeing and worming from health_records
  const [{ data: shoeingRows }, { data: wormingRows }] = await Promise.all([
    supabase
      .from("health_records")
      .select("*")
      .eq("horse_id", id)
      .eq("record_type", "shoeing")
      .order("record_date", { ascending: false })
      .limit(1),
    supabase
      .from("health_records")
      .select("*")
      .eq("horse_id", id)
      .eq("record_type", "worming")
      .order("record_date", { ascending: false })
      .limit(1),
  ]);

  const lastShoeing = (shoeingRows?.[0] as HealthRecord) ?? null;
  const lastWorming = (wormingRows?.[0] as HealthRecord) ?? null;

  return (
    <div className="min-h-screen bg-parchment">
      {/* Header bar */}
      <header className="border-b border-barn-dark/10 bg-white/80 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <span className="font-serif text-lg font-semibold text-barn-dark">
            BarnBook
          </span>
          <Link
            href="/auth/signin"
            className="text-xs font-medium text-brass-gold hover:underline"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-6">
        {/* Horse identity */}
        <div className="mb-5 flex items-center gap-4">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl">
            <HorsePhoto
              name={horse.name}
              photoUrl={horse.photo_url}
              aspectClassName="aspect-square w-full"
              className="rounded-2xl"
            />
          </div>
          <div>
            <h1 className="font-serif text-2xl font-semibold text-barn-dark">
              {horse.name}
            </h1>
            {horse.breed ? (
              <p className="text-sm text-barn-dark/55">{horse.breed}</p>
            ) : null}
          </div>
        </div>

        {/* Care card */}
        <div className="rounded-2xl border border-barn-dark/10 bg-white p-5 shadow-sm sm:p-6">
          <CareCard
            horse={horse}
            lastShoeing={lastShoeing}
            lastWorming={lastWorming}
            standalone
          />
        </div>

        <p className="mt-6 text-center text-xs text-barn-dark/40">
          Powered by{" "}
          <Link href="/" className="text-brass-gold hover:underline">
            BarnBook
          </Link>{" "}
          — Every horse. Every detail. One book.
        </p>
      </main>
    </div>
  );
}
