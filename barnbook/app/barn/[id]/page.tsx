import { createPublicSupabaseClient } from "@/lib/supabase-public";
import type { Barn, BarnPhoto, Horse } from "@/lib/types";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BarnProfileClient } from "./BarnProfileClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = createPublicSupabaseClient();
  const { data } = await supabase
    .from("barns")
    .select("name, about")
    .eq("id", id)
    .single();

  if (!data) return { title: "Barn not found — BarnBook" };
  return {
    title: `${data.name} | BarnBook`,
    description: data.about?.slice(0, 160) ?? `${data.name} on BarnBook — Every horse. Every detail. One book.`,
  };
}

export default async function PublicBarnProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createPublicSupabaseClient();

  const { data: barn, error } = await supabase
    .from("barns")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !barn) notFound();

  // Service Barns are a provider's private workspace — they don't have
  // a public profile. Redirect to the protected Service Barn dashboard;
  // unauthenticated visitors get bounced to sign-in from there.
  if ((barn as Barn).barn_type === "service") {
    redirect(`/barn/${id}/service`);
  }

  const [{ data: photosData }, { data: horsesData }] = await Promise.all([
    supabase
      .from("barn_photos")
      .select("*")
      .eq("barn_id", id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("horses")
      .select("id, name, breed, photo_url")
      .eq("barn_id", id)
      .order("name", { ascending: true }),
  ]);

  return (
    <BarnProfileClient
      barn={barn as Barn}
      photos={(photosData ?? []) as BarnPhoto[]}
      horses={(horsesData ?? []) as Pick<Horse, "id" | "name" | "breed" | "photo_url">[]}
    />
  );
}
