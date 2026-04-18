import { redirect } from "next/navigation";
import { createServerComponentClient } from "@/lib/supabase-server";
import { getActiveBarnContext } from "@/lib/barn-session";
import {
  canUserUseDocumentScanner,
  userHasAnyScannerAccess,
} from "@/lib/document-scanner/access";
import { IdentifyLanding } from "./IdentifyLanding";

export default async function IdentifyPage() {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const ctx = await getActiveBarnContext(supabase, user.id);
  const activeBarnId = ctx?.barn.id ?? null;

  const hasDocumentScanner = activeBarnId
    ? await canUserUseDocumentScanner(supabase, user.id, activeBarnId)
    : await userHasAnyScannerAccess(supabase, user.id);

  return (
    <IdentifyLanding
      hasDocumentScanner={hasDocumentScanner}
      activeBarnId={activeBarnId}
    />
  );
}
