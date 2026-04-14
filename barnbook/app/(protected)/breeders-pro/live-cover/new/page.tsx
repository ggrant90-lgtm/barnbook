import { redirect } from "next/navigation";
import { createServerComponentClient } from "@/lib/supabase-server";
import { getActiveBarnContext } from "@/lib/barn-session";
import { canUserEditHorse } from "@/lib/horse-access";
import { NewLiveCoverClient } from "./NewLiveCoverClient";

/**
 * Breeders Pro — Record Live Cover.
 *
 * Parallel to the Record Flush route. Fetches existing mares and
 * stallions for the pickers, then hands off to the client form.
 * The form posts through `recordLiveCoverAction`.
 */
export default async function NewLiveCoverPage() {
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

  // Existing mares — donor, recipient, or multiple breeding roles.
  const { data: mares } = await supabase
    .from("horses")
    .select("id, name, registration_number, breeding_role")
    .eq("barn_id", barnId)
    .eq("archived", false)
    .in("breeding_role", ["donor", "recipient", "multiple"])
    .order("name", { ascending: true });

  // Existing barn stallions.
  const { data: stallions } = await supabase
    .from("horses")
    .select("id, name, registration_number, breeding_role")
    .eq("barn_id", barnId)
    .eq("archived", false)
    .in("breeding_role", ["stallion", "multiple"])
    .order("name", { ascending: true });

  return (
    <NewLiveCoverClient
      mares={
        (mares ?? []) as {
          id: string;
          name: string;
          registration_number: string | null;
        }[]
      }
      stallions={
        (stallions ?? []) as {
          id: string;
          name: string;
          registration_number: string | null;
        }[]
      }
      barnId={barnId}
    />
  );
}
