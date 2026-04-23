import { redirect } from "next/navigation";
import { createServerComponentClient } from "@/lib/supabase-server";
import { getActiveBarnContext } from "@/lib/barn-session";
import {
  userHasAnyScannerAccess,
  canUserUseDocumentScanner,
} from "@/lib/document-scanner/access";
import { getEffectiveCapacityMap } from "@/lib/stalls-query";
import type { StallFlowBarnOption } from "@/components/stalls/StallPurchaseFlow";
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

  // Fetch barns the user owns so the StallPurchaseFlow can list them for
  // expansion. Membership-only barns are intentionally excluded — only
  // barn owners can add stall blocks.
  const { data: ownedBarns } = await supabase
    .from("barns")
    .select("id, name, base_stalls")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true });

  const barnIds = (ownedBarns ?? []).map((b) => b.id);

  const [horseCountsRes, capacityMap] = await Promise.all([
    supabase
      .from("horses")
      .select("barn_id")
      .in("barn_id", barnIds)
      .eq("archived", false),
    getEffectiveCapacityMap(supabase, barnIds),
  ]);

  const horseCountByBarn = new Map<string, number>();
  for (const h of (horseCountsRes.data ?? []) as Array<{ barn_id: string }>) {
    horseCountByBarn.set(h.barn_id, (horseCountByBarn.get(h.barn_id) ?? 0) + 1);
  }

  const userBarns: StallFlowBarnOption[] = (ownedBarns ?? []).map((b) => ({
    id: b.id,
    name: b.name,
    horseCount: horseCountByBarn.get(b.id) ?? 0,
    effectiveCapacity: capacityMap.get(b.id) ?? (b.base_stalls ?? 0),
  }));

  return (
    <NewHorseShell
      hasDocumentScanner={hasDocumentScanner}
      activeBarnId={activeBarnId}
      userBarns={userBarns}
    />
  );
}
