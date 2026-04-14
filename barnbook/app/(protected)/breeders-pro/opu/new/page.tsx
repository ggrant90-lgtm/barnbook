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

  // Fetch donor mares for the donor picker — include donor and multiple roles,
  // plus any mare regardless of breeding_role (some may not be tagged yet).
  const { data: mares } = await supabase
    .from("horses")
    .select("id, name, registration_number, breeding_role")
    .eq("barn_id", barnId)
    .eq("archived", false)
    .or("sex.eq.mare,breeding_role.eq.donor,breeding_role.eq.multiple")
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
