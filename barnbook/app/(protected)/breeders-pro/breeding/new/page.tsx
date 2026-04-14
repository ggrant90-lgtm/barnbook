import { redirect } from "next/navigation";
import { createServerComponentClient } from "@/lib/supabase-server";
import { getActiveBarnContext } from "@/lib/barn-session";
import { canUserEditHorse } from "@/lib/horse-access";
import { BreedingHubClient } from "./BreedingHubClient";

/**
 * Breeders Pro — New Breeding Event hub.
 *
 * Universal entry point for all breeding methods: Flush (ET),
 * Live Cover, and AI (coming soon). Routes the user to the
 * appropriate form based on their selection.
 */
export default async function BreedingHubPage() {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const ctx = await getActiveBarnContext(supabase, user.id);
  const barnId = ctx?.barn?.id;
  if (!barnId) redirect("/breeders-pro");

  const canEdit = await canUserEditHorse(supabase, user.id, barnId);
  if (!canEdit) redirect("/breeders-pro");

  return <BreedingHubClient />;
}
