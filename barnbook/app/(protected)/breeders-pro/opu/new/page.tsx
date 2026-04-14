import { redirect } from "next/navigation";
import { createServerComponentClient } from "@/lib/supabase-server";
import { getActiveBarnContext } from "@/lib/barn-session";
import { canUserEditHorse } from "@/lib/horse-access";
import { NewOPUClient } from "./NewOPUClient";

/**
 * Breeders Pro — Record OPU Session.
 *
 * Event-first entry point for the ICSI pipeline. User selects
 * (or creates) a donor mare, enters aspiration details and
 * oocyte count, and submits. The RPC atomically creates the
 * OPU session + N individual oocyte rows with auto-generated
 * codes (OC-YYYY-NNNN).
 */
export default async function NewOPUPage() {
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

  // Fetch mares for the donor picker
  const { data: mares } = await supabase
    .from("horses")
    .select("id, name, registration_number")
    .eq("barn_id", barnId)
    .eq("sex", "mare")
    .eq("archived", false)
    .order("name", { ascending: true });

  return (
    <NewOPUClient
      barnId={barnId}
      mares={
        (mares ?? []) as {
          id: string;
          name: string;
          registration_number: string | null;
        }[]
      }
    />
  );
}
