import { redirect } from "next/navigation";
import { createServerComponentClient } from "@/lib/supabase-server";
import { getActiveBarnContext } from "@/lib/barn-session";
import { userHasAnyScannerAccess, canUserUseDocumentScanner } from "@/lib/document-scanner/access";
import { NewHorseShell } from "./NewHorseShell";

export default async function NewHorsePage() {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const ctx = await getActiveBarnContext(supabase, user.id);
  const activeBarnId = ctx?.barn.id ?? null;

  // Scanner access — prefer barn-scoped check if we have one.
  const hasDocumentScanner = activeBarnId
    ? await canUserUseDocumentScanner(supabase, user.id, activeBarnId)
    : await userHasAnyScannerAccess(supabase, user.id);

  return (
    <NewHorseShell
      hasDocumentScanner={hasDocumentScanner}
      activeBarnId={activeBarnId}
    />
  );
}
